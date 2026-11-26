# Build notes

## Why this project?

November 27, 2026 is Black Friday. I wanted a puzzle about the part of online shopping that comes after the sale banner. AP reported that shoppers were putting more everyday goods in their holiday carts, which made a small, ordinary add-on a better prop for the puzzle than another big-ticket item. [AP's Black Friday coverage](https://apnews.com/article/5e542ffd1f94f24e4ffb79d412223544)

## How it works

The fictional shop rounds the percentage discount to the nearest cent, then subtracts that discount from the subtotal. A discounted subtotal of $55 or more ships free. Below $55, the shop charges $9. The optional item counts toward the subtotal and qualifies for either coupon. All calculations use integer cents. The comparison tries each of the three coupon choices with and without the optional item, sorts by total, and marks every combination tied for the lowest price.

## What made the numbers work?

The $64 desk basket lands at $56 with the flat coupon. The percentage coupon takes it down to $54.40, sixty cents below the shipping cutoff. The $1.50 binder clip raises the subtotal to $65.50, which qualifies for free shipping after the $9.83 discount. The final $55.67 beats the flat coupon by 33 cents.

The other baskets are tuned so the winning strategy changes. On Weekend Away the flat coupon wins with the optional item, while Studio Shelf wins with the percentage coupon alone. The comparison lets you test any of those totals against the itemized receipt.
