# rentsim: what would the rental bill do?

Prototype simulator of Portugal's 2026 rental-law bill and of the housing movement's
counterfactuals: rents, rental supply, rent burdens, eviction filings and displacement, with
90% intervals. Design, evidence and plan: [`../docs/POLICY_SIM.md`](../docs/POLICY_SIM.md).

```bash
uv sync
uv run rentsim out            # calibrate, run 10 policies, write out/summary.{json,md} (~4 s)
uv run python -m pytest -q    # 43 tests, no network
```

- `rentsim/data.py`: observed inputs (Lisbon parishes from `../src/data/fontes/`; the
  município loader waits for estimador-data's housing collector).
- `rentsim/priors.py`: every assumption, with a 90% interval, a status and a source.
- `rentsim/trend.py`: Bayesian hierarchical model of new-lease rent growth (Gibbs).
- `rentsim/policy.py`: the law today, the bill, its parts, the counterfactuals.
- `rentsim/model.py`: the yearly simulation.
- `rentsim/calibrate.py`: importance resampling on INE's 2024-2025 rents.
- `rentsim/report.py`: paired comparisons, sensitivity, the report.
- `results/`: dated runs kept for comparison. **Prototype: not for publication.**
