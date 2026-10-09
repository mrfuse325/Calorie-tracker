# Goal calculator and food lookup

This extends the agreed base release with the two features requested after milestone 1. It supersedes the original plan's manual-target-only restriction: users may calculate estimates and explicitly apply them, while manual target editing remains available.

The calculator follows the core input flow of [Calculator.net's protein calculator](https://www.calculator.net/protein-calculator.html), with an original UI and locally implemented formulas. It estimates maintenance calories from Mifflin–St Jeor resting energy and a selected activity factor. Protein, carbohydrate, and fat targets derive from a user-selected calorie split, with adult ranges and a weight-based protein reference visible beside them. Only generally healthy adults ages 19–80 are supported. Alternate BMR formulas, athletic protein prescriptions, weight-change calculations, and special medical/pregnancy modes are not included.

Food lookup uses USDA generic food search through the local Node server and triggers after an 800 ms typing pause or an explicit search. Food selection is required; preparation variants are not silently averaged. Only gram-based generic records are included. A selected food fills per-100 g calories/macros and scales with the entered quantity. Recorded entries retain nutrient and source snapshots.

Provider configuration, cache, quotas, failure behavior, and verification commands are documented in the README. No paid APIs or AI services are introduced. JSON backup/restore, reusable foods, cross-device sync, and hosted deployment remain separate work.
