import os
import json
import numpy as np
from sklearn.linear_model import LogisticRegression
from ..data.generate_dataset import generate_synthetic_data

_model: LogisticRegression | None = None

def init_ml_model() -> LogisticRegression:
    global _model
    if _model is not None:
        return _model

    data_file = os.path.join(os.path.dirname(__file__), "../data/synthetic_training.json")
    if os.path.exists(data_file):
        with open(data_file, "r") as f:
            dataset = json.load(f)
    else:
        dataset = generate_synthetic_data(500)

    X = np.array([item["features"] for item in dataset])
    y = np.array([item["label"] for item in dataset])

    clf = LogisticRegression(random_state=42, C=1.0)
    clf.fit(X, y)
    _model = clf
    return _model

def predict_ml_probability(feature_vector: list[float]) -> float:
    clf = init_ml_model()
    x_arr = np.array([feature_vector])
    prob = clf.predict_proba(x_arr)[0][1]
    return float(prob)
