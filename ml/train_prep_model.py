"""Train Plate-Link's "how much should we cook?" model.

Approach (probabilistic forecast + newsvendor):
  1. A LightGBM model predicts next-period demand for a dish from its last
     4 periods of sales, dish category/cuisine, discount and promotion flags.
     It is trained in log space on demand *relative to the 4-period mean*, so
     it transfers across kitchens of different sizes.
  2. Out-of-sample residuals, bucketed by how volatile the dish has been,
     turn the point forecast into a full demand distribution (P1…P99).
  3. The cost-optimal quantity is the critical-ratio quantile
         tau* = underage / (underage + overage)
     where overage = cost of one unsold portion, underage = margin lost on one
     missed sale. (Classic newsvendor result.)

Data: Food Demand Forecasting (Genpact × Analytics Vidhya) — real weekly orders,
456,548 rows, 77 kitchens, 51 dishes, 145 weeks. Run get_data.py first.

Split (time-based, no leakage):
  train  weeks  5–125  → fit LightGBM
  calib  weeks 126–135 → residual quantile table
  test   weeks 136–145 → all reported metrics

Outputs:
  ../packages/shared/src/prep-model/model.json   (compact trees + residual table, read by the web/mobile apps)
  reports/metrics.json                            (numbers for the README / viva)
"""
from __future__ import annotations

import json
import pathlib

import lightgbm as lgb
import numpy as np
import pandas as pd

ROOT = pathlib.Path(__file__).parent
DATA = ROOT / "data"
OUT_MODEL = ROOT.parent / "packages" / "shared" / "src" / "prep-model" / "model.json"
OUT_REPORT = ROOT / "reports" / "metrics.json"

CATEGORIES = [
    "Beverages", "Biryani", "Desert", "Extras", "Fish", "Other Snacks", "Pasta",
    "Pizza", "Rice Bowl", "Salad", "Sandwich", "Seafood", "Soup", "Starters",
]
CUISINES = ["Continental", "Indian", "Italian", "Thai"]
N_LAGS = 4
N_BINS = 5
PROBS = np.round(np.arange(0.01, 1.0, 0.01), 2)  # 99 quantile levels
SEED = 7

FEATURES = (
    ["log_scale", "cv4", "trend"]
    + [f"rel_lag{k}" for k in range(1, N_LAGS + 1)]
    + ["discount_pct", "promo_announced", "promo_featured"]
    + [f"cat_{c}" for c in CATEGORIES]
    + [f"cui_{c}" for c in CUISINES]
)


# ----------------------------------------------------------------------------- features
def build_frame() -> pd.DataFrame:
    train = pd.read_csv(DATA / "train.csv")
    meals = pd.read_csv(DATA / "meal_info.csv")
    df = train.merge(meals, on="meal_id", how="left")

    # Full week grid per series so lags mean "exactly k weeks ago".
    df = df.sort_values(["center_id", "meal_id", "week"])
    key = ["center_id", "meal_id"]
    grid = (
        df[key].drop_duplicates()
        .merge(pd.DataFrame({"week": np.arange(1, df.week.max() + 1)}), how="cross")
    )
    df = grid.merge(df, on=key + ["week"], how="left").sort_values(key + ["week"])

    g = df.groupby(key, sort=False)["num_orders"]
    for k in range(1, N_LAGS + 1):
        df[f"lag{k}"] = g.shift(k)

    df = df.dropna(subset=["num_orders"] + [f"lag{k}" for k in range(1, N_LAGS + 1)]).copy()
    return add_features(df)


def add_features(df: pd.DataFrame) -> pd.DataFrame:
    lags = df[[f"lag{k}" for k in range(1, N_LAGS + 1)]].to_numpy(dtype=float)
    mean4 = lags.mean(axis=1)
    std4 = lags.std(axis=1)
    out = pd.DataFrame(index=df.index)
    out["log_scale"] = np.log1p(mean4)
    out["cv4"] = std4 / np.maximum(mean4, 1.0)
    out["trend"] = np.log1p(lags[:, 0]) - np.log1p(lags[:, 1:].mean(axis=1))
    for k in range(N_LAGS):
        out[f"rel_lag{k + 1}"] = np.log1p(lags[:, k]) - out["log_scale"]
    out["discount_pct"] = ((df["base_price"] - df["checkout_price"]) / df["base_price"]).clip(-0.5, 0.8)
    out["promo_announced"] = df["emailer_for_promotion"].astype(float)
    out["promo_featured"] = df["homepage_featured"].astype(float)
    for c in CATEGORIES:
        out[f"cat_{c}"] = (df["category"] == c).astype(float)
    for c in CUISINES:
        out[f"cui_{c}"] = (df["cuisine"] == c).astype(float)

    out["week"] = df["week"].to_numpy()
    out["y"] = df["num_orders"].to_numpy()
    out["mean4"] = mean4
    out["lag1"] = lags[:, 0]
    out["price"] = df["checkout_price"].to_numpy()
    out["target"] = np.log1p(out["y"]) - out["log_scale"]
    return out


# ----------------------------------------------------------------------------- model
def fit(train: pd.DataFrame, valid: pd.DataFrame) -> lgb.Booster:
    params = dict(
        objective="regression", learning_rate=0.05, num_leaves=31, min_data_in_leaf=200,
        feature_fraction=0.9, bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0,
        verbose=-1, seed=SEED, deterministic=True, force_row_wise=True,
    )
    dtrain = lgb.Dataset(train[FEATURES], train["target"])
    dvalid = lgb.Dataset(valid[FEATURES], valid["target"], reference=dtrain)
    return lgb.train(
        params, dtrain, num_boost_round=600, valid_sets=[dvalid],
        callbacks=[lgb.early_stopping(50, verbose=False)],
    )


def residual_table(model: lgb.Booster, calib: pd.DataFrame):
    pred = model.predict(calib[FEATURES], num_iteration=model.best_iteration)
    resid = calib["target"].to_numpy() - pred
    edges = np.quantile(calib["cv4"], np.linspace(0, 1, N_BINS + 1)[1:-1])
    bins = np.digitize(calib["cv4"], edges)
    table = [np.quantile(resid[bins == b], PROBS).tolist() for b in range(N_BINS)]
    return edges.tolist(), table


def predict_quantiles(model, edges, table, frame: pd.DataFrame, taus: np.ndarray) -> np.ndarray:
    """Demand quantiles in original units, shape (rows, len(taus))."""
    base = model.predict(frame[FEATURES], num_iteration=model.best_iteration) + frame["log_scale"].to_numpy()
    bins = np.digitize(frame["cv4"], edges)
    q = np.array([[np.interp(t, PROBS, table[b]) for t in taus] for b in bins])
    return np.maximum(np.expm1(base[:, None] + q), 0.0)


# ----------------------------------------------------------------------------- evaluation
def rmsle(y, p):
    return float(np.sqrt(np.mean((np.log1p(np.maximum(p, 0)) - np.log1p(y)) ** 2)))


def newsvendor_eval(y, prep, price, cost_share):
    cost = price * cost_share
    sold = np.minimum(prep, y)
    leftover = np.maximum(prep - y, 0)
    short = np.maximum(y - prep, 0)
    return dict(
        prepared=float(prep.sum()),
        leftover=float(leftover.sum()),
        leftover_pct=float(100 * leftover.sum() / prep.sum()),
        stockout_units=float(short.sum()),
        fill_rate_pct=float(100 * sold.sum() / y.sum()),
        profit=float((price * sold - cost * prep).sum()),
    )


def export(model: lgb.Booster, edges, table, metrics) -> None:
    dump = model.dump_model(num_iteration=model.best_iteration)
    trees = []
    for t in dump["tree_info"]:
        f, thr, left, right, leaves = [], [], [], [], []

        def walk(node) -> int:
            if "leaf_value" in node:
                leaves.append(round(node["leaf_value"], 7))
                return ~(len(leaves) - 1)  # negative → leaf index
            assert node["decision_type"] == "<=", node["decision_type"]
            i = len(f)
            f.append(node["split_feature"])
            thr.append(float(node["threshold"]))
            left.append(0)
            right.append(0)
            left[i] = walk(node["left_child"])
            right[i] = walk(node["right_child"])
            return i

        walk(t["tree_structure"])
        trees.append({"f": f, "t": thr, "l": left, "r": right, "v": leaves})

    payload = {
        "version": 1,
        "dataset": "Food Demand Forecasting (Genpact × Analytics Vidhya) — 456,548 real weekly orders, 77 kitchens, 51 dishes",
        "features": FEATURES,
        "categories": CATEGORIES,
        "cuisines": CUISINES,
        "nLags": N_LAGS,
        "probs": PROBS.tolist(),
        "cvEdges": [round(e, 6) for e in edges],
        "residualQuantiles": [[round(v, 5) for v in row] for row in table],
        "trees": trees,
        "metrics": metrics["summary"],
    }
    OUT_MODEL.parent.mkdir(parents=True, exist_ok=True)
    OUT_MODEL.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"model → {OUT_MODEL} ({OUT_MODEL.stat().st_size / 1e3:.0f} kB, {len(trees)} trees)")


# ----------------------------------------------------------------------------- main
def main() -> None:
    df = build_frame()
    train = df[df.week <= 125]
    calib = df[(df.week > 125) & (df.week <= 135)]
    test = df[df.week > 135]
    print(f"rows: train {len(train):,} · calib {len(calib):,} · test {len(test):,}")

    model = fit(train, calib)
    edges, table = residual_table(model, calib)

    y = test["y"].to_numpy()
    median = predict_quantiles(model, edges, table, test, np.array([0.5]))[:, 0]
    point = {
        "model_median": rmsle(y, median),
        "naive_last_week": rmsle(y, test["lag1"].to_numpy()),
        "mean_last_4": rmsle(y, test["mean4"].to_numpy()),
    }

    # Calibration: share of actual demand below each predicted quantile.
    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    qs = predict_quantiles(model, edges, table, test, taus)
    coverage = {f"P{int(t * 100)}": float((y <= qs[:, i]).mean()) for i, t in enumerate(taus)}

    # Business value: food cost = 40% of menu price (typical Indian canteen/QSR).
    cost_share = 0.40
    tau_star = (1 - cost_share) / 1.0  # underage = price − cost, overage = cost
    price = test["price"].to_numpy()
    prep_model = np.round(predict_quantiles(model, edges, table, test, np.array([tau_star]))[:, 0])
    policies = {
        "cook_last_week": newsvendor_eval(y, test["lag1"].to_numpy(), price, cost_share),
        "cook_4wk_average": newsvendor_eval(y, np.round(test["mean4"].to_numpy()), price, cost_share),
        "plate_link_model": newsvendor_eval(y, prep_model, price, cost_share),
    }
    base = policies["cook_last_week"]
    ours = policies["plate_link_model"]
    summary = {
        "test_weeks": "136–145",
        "test_rows": int(len(test)),
        "rmsle_model": round(point["model_median"], 4),
        "rmsle_naive": round(point["naive_last_week"], 4),
        "leftover_pct_naive": round(base["leftover_pct"], 1),
        "leftover_pct_model": round(ours["leftover_pct"], 1),
        "leftover_reduction_pct": round(100 * (1 - ours["leftover"] / base["leftover"]), 1),
        "profit_uplift_pct": round(100 * (ours["profit"] / base["profit"] - 1), 1),
        "fill_rate_model_pct": round(ours["fill_rate_pct"], 1),
        "fill_rate_naive_pct": round(base["fill_rate_pct"], 1),
        "cost_share_assumed": cost_share,
    }
    metrics = {
        "point_accuracy_rmsle": point,
        "quantile_coverage": coverage,
        "newsvendor": {"cost_share": cost_share, "tau_star": tau_star, "policies": policies},
        "best_iteration": model.best_iteration,
        "feature_importance_gain": dict(
            sorted(
                zip(FEATURES, model.feature_importance("gain", iteration=model.best_iteration).round(1).tolist()),
                key=lambda kv: -kv[1],
            )[:12]
        ),
        "summary": summary,
    }
    OUT_REPORT.parent.mkdir(exist_ok=True)
    OUT_REPORT.write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2))

    export(model, edges, table, metrics)

    # Golden samples so the TypeScript port can be checked against Python.
    sample = test.sample(25, random_state=SEED)
    gold_q = predict_quantiles(model, edges, table, sample, np.array([0.1, 0.5, 0.6, 0.9]))
    golden = [
        {"x": {k: float(sample.iloc[i][k]) for k in FEATURES}, "q": gold_q[i].round(4).tolist()}
        for i in range(len(sample))
    ]
    (ROOT / "reports" / "golden.json").write_text(json.dumps(golden))


if __name__ == "__main__":
    main()
