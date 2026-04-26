import json
import sys
from pathlib import Path
from typing import Dict, List, Set


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from word_format_checker import detect_word_format  # noqa: E402


EXPECTED_DIR = Path(__file__).resolve().parent / "expected"
SAMPLES_DIR = Path(__file__).resolve().parent / "samples"


TRACKED_LABELS = {
    "body_font",
    "body_font_size",
    "line_spacing",
    "first_line_indent",
    "heading_format",
    "reference_number_not_continuous",
}

ALIASES = {
    "reference_numbering": "reference_number_not_continuous",
}


def _normalize_label(problem_type: str) -> str:
    return ALIASES.get(problem_type, problem_type)


def _load_expected() -> List[Dict]:
    out = []
    for path in sorted(EXPECTED_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        out.append(payload)
    return out


def _predicted_labels(sample_path: Path) -> Set[str]:
    result = detect_word_format(str(sample_path))
    labels = set()
    for issue in result.get("issues", []):
        label = _normalize_label(str(issue.get("problem_type", "")))
        if label in TRACKED_LABELS:
            labels.add(label)
    return labels


def evaluate_accuracy():
    expected_cases = _load_expected()
    if not expected_cases:
        raise RuntimeError("No expected json found. Run generate_test_docs.py first.")

    true_positive = 0
    false_positive = 0
    false_negative = 0
    case_rows = []

    for case in expected_cases:
        sample_name = case["sample"]
        sample_path = SAMPLES_DIR / sample_name
        if not sample_path.exists():
            raise FileNotFoundError(f"Sample file not found: {sample_path}")

        expected = set(case.get("expected_problem_types", []))
        predicted = _predicted_labels(sample_path)

        tp = len(expected & predicted)
        fp = len(predicted - expected)
        fn = len(expected - predicted)

        true_positive += tp
        false_positive += fp
        false_negative += fn

        case_rows.append(
            {
                "sample": sample_name,
                "expected": sorted(expected),
                "predicted": sorted(predicted),
                "tp": tp,
                "fp": fp,
                "fn": fn,
            }
        )

    precision = true_positive / (true_positive + false_positive) if (true_positive + false_positive) else 0.0
    recall = true_positive / (true_positive + false_negative) if (true_positive + false_negative) else 0.0
    f1_score = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0

    summary = {
        "true_positive": true_positive,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1_score, 4),
        "cases": case_rows,
    }
    return summary


def main():
    summary = evaluate_accuracy()
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
