name: Walmart Monitor

on:
  schedule:
    - cron: "* * * * *"
  workflow_dispatch:

jobs:
  run:
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm install

      - run: node walmart.js
        env:
          WEBHOOK_URL: ${{ secrets.WEBHOOK_URL }}
