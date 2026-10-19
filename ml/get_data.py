"""Download the Food Demand Forecasting dataset (Genpact x Analytics Vidhya, 2018).

Real anonymised weekly order data from a meal-delivery company:
456,548 rows · 77 fulfilment centres · 51 dishes · 145 weeks.
Original: https://www.kaggle.com/datasets/kannanaikkal/food-demand-forecasting
This script pulls a public GitHub mirror so no Kaggle login is needed.
"""
import pathlib
import urllib.request

MIRROR = "https://raw.githubusercontent.com/Aniket1313/Project-Demand-Forecasting/main/"
FILES = ["train.csv", "meal_info.csv", "fulfilment_center_info.csv"]
OUT = pathlib.Path(__file__).parent / "data"


def main() -> None:
    OUT.mkdir(exist_ok=True)
    for name in FILES:
        dest = OUT / name
        if dest.exists():
            print(f"✓ {name} (cached)")
            continue
        print(f"↓ {name} …", flush=True)
        urllib.request.urlretrieve(MIRROR + name, dest)
        print(f"✓ {name} ({dest.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
