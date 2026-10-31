import os
import json
import numpy as np

def generate_synthetic_data(num_samples: int = 500) -> list[dict]:
    np.random.seed(42)
    dataset = []

    for _ in range(num_samples):
        # Generate correlated features
        is_match = np.random.rand() > 0.45

        if is_match:
            cat_sim = np.random.uniform(0.8, 1.0)
            brand_sim = np.random.uniform(0.7, 1.0)
            model_sim = np.random.uniform(0.6, 1.0)
            color_sim = np.random.uniform(0.4, 1.0)
            loc_sim = np.random.uniform(0.5, 1.0)
            date_sim = np.random.uniform(0.6, 1.0)
            feat_sim = np.random.uniform(0.5, 1.0)
            sem_sim = np.random.uniform(0.65, 1.0)
            label = 1
        else:
            cat_sim = np.random.uniform(0.0, 0.6)
            brand_sim = np.random.uniform(0.0, 0.5)
            model_sim = np.random.uniform(0.0, 0.4)
            color_sim = np.random.uniform(0.0, 0.5)
            loc_sim = np.random.uniform(0.0, 0.5)
            date_sim = np.random.uniform(0.0, 0.5)
            feat_sim = np.random.uniform(0.0, 0.3)
            sem_sim = np.random.uniform(0.0, 0.5)
            label = 0

        dataset.append({
            "features": [cat_sim, brand_sim, model_sim, color_sim, loc_sim, date_sim, feat_sim, sem_sim],
            "label": label
        })

    return dataset

if __name__ == "__main__":
    data = generate_synthetic_data()
    out_dir = os.path.dirname(__file__)
    with open(os.path.join(out_dir, "synthetic_training.json"), "w") as f:
        json.dump(data, f, indent=2)
    print(f"Generated {len(data)} training examples.")
