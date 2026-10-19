# Plate-Link prep model

Answers: **"How many portions of this dish should we cook?"**

## Data
[Food Demand Forecasting](https://www.kaggle.com/datasets/kannanaikkal/food-demand-forecasting) (Genpact × Analytics Vidhya, 2018): real, anonymised weekly orders from a meal-delivery company: 456,548 rows, 77 kitchens, 51 dishes, 145 weeks. Ingredients are perishable and bought weekly, which is the same planning problem a canteen has.

`python get_data.py` downloads it from a public GitHub mirror (no Kaggle login needed).

## Method
1. **Demand forecast.** A LightGBM model predicts next-period demand from:
   - the last 4 periods of sales,
   - dish category and cuisine,
   - discount,
   - whether the dish was announced or featured.

   It learns demand relative to the 4-period average (in log space), so it carries over to kitchens of any size.
2. **Uncertainty.** Errors on a calibration period, grouped by how volatile the dish has been, turn the single forecast into a full distribution (P1–P99).
3. **Decision (newsvendor).** Cook the τ\* quantile, where τ\* = (price − cost) / price. A missed sale costs the margin; a leftover costs the food.

Split is by time: train on weeks 5–125, calibrate on 126–135, test on 136–145. No week is used in more than one role.

## Results (test weeks 136–145, 28,535 dish-weeks, food cost = 40% of price)
| | Cook last week's number | Plate-Link model |
|---|---|---|
| Forecast error (RMSLE) | 0.646 | **0.492** |
| Leftovers (% of food cooked) | 17.5% | **15.3%** (−10.7% leftover volume) |
| Demand served | 83.7% | **87.9%** |
| Profit | baseline | **+9.3%** |

Quantile calibration: predicted P10/P50/P90 cover 9.5% / 47.4% / 89.4% of actual demand.

Full numbers: `reports/metrics.json`.

## Retrain
```bash
cd ml
pip install -r requirements.txt
python get_data.py
python train_prep_model.py   # writes packages/shared/src/prep-model/model.json
```
The model runs in TypeScript (`packages/shared/src/prep-model`), in the browser and later on the phone, offline. Its output matches Python to within 0.001%; check this against `reports/golden.json` after retraining.

## Limits / next step
The training data comes from a meal-delivery company, not a canteen. Once canteens log their actual sales in Plate-Link, retrain on that data (same script, new CSV) to make the forecasts their own.
