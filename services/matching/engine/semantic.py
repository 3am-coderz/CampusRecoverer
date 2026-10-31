import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from rapidfuzz import fuzz

_st_model = None
_st_load_attempted = False

SYNONYM_CLUSTERS = [
    {"small", "tiny", "little", "minor", "slight"},
    {"scratch", "mark", "scuff", "nick", "dent", "blemish"},
    {"bottom", "lower", "under", "base"},
    {"corner", "edge", "rim", "border", "side"},
    {"top", "upper", "head"},
    {"front", "face", "forward"},
    {"back", "rear", "behind"},
    {"case", "sleeve", "cover", "pouch", "bag"},
    {"sticker", "decal", "badge", "emblem", "patch", "logo"},
    {"black", "dark", "matte black", "charcoal"},
    {"silver", "gray", "grey", "space gray"},
    {"navy", "blue", "navy blue", "dark blue"},
]

def canonicalize_text(text: str) -> str:
    tokens = re.findall(r'\b\w+\b', text.lower())
    canonical_tokens = []
    for token in tokens:
        replaced = False
        for cluster in SYNONYM_CLUSTERS:
            if token in cluster:
                # Use sorted first element as representative canonical token
                canonical_tokens.append(sorted(cluster)[0])
                replaced = True
                break
        if not replaced:
            canonical_tokens.append(token)
    return " ".join(canonical_tokens)

def get_sentence_transformer():
    global _st_model, _st_load_attempted
    if not _st_load_attempted:
        _st_load_attempted = True
        try:
            from sentence_transformers import SentenceTransformer
            _st_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception:
            _st_model = None
    return _st_model

def calculate_semantic_similarity(text1: str, text2: str) -> tuple[float, bool]:
    """
    Returns (similarity_score_0_to_100, transformer_used)
    """
    t1 = (text1 or "").strip()
    t2 = (text2 or "").strip()
    if not t1 or not t2:
        return 0.0, False

    # Check for SentenceTransformer model
    model = get_sentence_transformer()
    if model is not None:
        try:
            emb1 = model.encode(t1)
            emb2 = model.encode(t2)
            st_sim = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))
            st_sim = max(0.0, min(1.0, st_sim))
            return round(st_sim * 100.0, 1), True
        except Exception:
            pass

    # Fallback: Canonicalized TF-IDF + Char N-gram + Token Set
    c1 = canonicalize_text(t1)
    c2 = canonicalize_text(t2)

    try:
        tfidf = TfidfVectorizer(ngram_range=(1, 2))
        matrix = tfidf.fit_transform([c1, c2])
        tfidf_sim = float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])
    except Exception:
        tfidf_sim = 0.0

    # Token ratio on canonicalized
    fuzz_sim = fuzz.token_set_ratio(c1, c2) / 100.0

    # Char n-gram similarity on original
    try:
        char_tfidf = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 4))
        c_matrix = char_tfidf.fit_transform([t1.lower(), t2.lower()])
        char_sim = float(cosine_similarity(c_matrix[0:1], c_matrix[1:2])[0][0])
    except Exception:
        char_sim = 0.0

    combined = 0.5 * fuzz_sim + 0.3 * tfidf_sim + 0.2 * char_sim
    return round(combined * 100.0, 1), False
