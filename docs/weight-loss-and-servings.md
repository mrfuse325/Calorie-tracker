# Weight-loss goals and servings

The calculator now defaults to feet/inches and pounds. Existing metric profiles are converted for display; original diary entries retain their units. Activity includes the reference's 1.465 factor. Users choose maintenance or estimated loss of 0.5, 1, or 2 lb/week. A comparison table displays each daily calorie target. Macros are recomputed from the selected calorie target and chosen split.

The estimate follows the simple convention in [the reference calculator](https://www.calculator.net/calorie-calculator.html): daily deficit = weekly pounds × 3,500 / 7. It is not a prediction of exact weight change; [NIDDK notes that calorie requirements change during weight loss](https://www.niddk.nih.gov/health-information/weight-management/adult-overweight-obesity/eating-physical-activity). The app will not automatically apply weight-loss targets below 1,500 kcal for the male coefficient or 1,200 for the female coefficient, or for an underweight BMI. The limit is explicit and does not silently change the selected rate; slower choices and manual targets remain available. Special medical/pregnancy/child needs remain out of scope.

New manual entries default to nutrition per one serving and one serving eaten. USDA selection fetches food details to get real portions (such as 1 cup or 1 slice) and gram weights, then converts its canonical 100 g data to that portion. The selected portion label and gram weight are saved alongside nutrition snapshots. Half-servings and multiple servings scale linearly. If portions are missing or details fail, the user defines their serving's weight or uses grams; no universal serving weight is invented.

Hosted deployment preparation is described in [phone-hosting.md](phone-hosting.md).
