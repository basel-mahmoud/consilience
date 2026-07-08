"""Deterministic source-credibility scoring by domain class.

A transparent, testable heuristic — no LLM call. It ranks *where* a claim's
evidence comes from, which the mesh uses to weight agreement in M3b. It is not
a judgment of the specific page's accuracy, only the source class's reliability.
"""

from urllib.parse import urlsplit

from mesh.schemas import Confidence

# Suffixes and hosts whose institutional accountability makes them high-trust.
_HIGH_SUFFIXES = (".gov", ".edu", ".mil", ".int", ".gov.uk", ".ac.uk")
_HIGH_HOSTS = frozenset({
    "who.int", "nih.gov", "nasa.gov", "nature.com", "science.org",
    "sciencedirect.com", "arxiv.org", "pubmed.ncbi.nlm.nih.gov",
    "ipcc.ch", "oecd.org", "worldbank.org", "un.org", "europa.eu",
})
# Established outlets and reference works: generally reliable, not primary.
_MID_HOSTS = frozenset({
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com",
    "wsj.com", "economist.com", "ft.com", "theguardian.com", "npr.org",
    "wikipedia.org", "britannica.com", "bloomberg.com", "washingtonpost.com",
})
_MID_SUFFIXES = (".org",)
# User-generated / low-accountability platforms.
_LOW_HOSTS = frozenset({
    "medium.com", "substack.com", "reddit.com", "quora.com", "blogspot.com",
    "wordpress.com", "facebook.com", "x.com", "twitter.com", "youtube.com",
    "tiktok.com", "linkedin.com",
})


# Search-grounding providers return redirect wrappers, not the real source URL;
# the actual domain arrives out of band (Gemini puts it in the citation title).
_REDIRECT_HOSTS = ("vertexaisearch.cloud.google.com", "grounding-api-redirect")


def _registrable_host(url: str) -> str | None:
    host = urlsplit(url if "://" in url else f"//{url}").hostname
    return host.lower().removeprefix("www.") if host else None


def score(url: str, domain_hint: str | None = None) -> tuple[Confidence, str]:
    """Return (credibility, rationale) for a source.

    `domain_hint` is the real domain when `url` is a search-grounding redirect
    wrapper (e.g. Gemini's vertexaisearch redirect), which carries no signal itself.
    """
    host = _registrable_host(url)
    if (host is None or any(marker in host for marker in _REDIRECT_HOSTS)) and domain_hint:
        host = _registrable_host(domain_hint)
    if host is None:
        return "low", "Unrecognized or malformed source URL."

    if host in _HIGH_HOSTS or host.endswith(_HIGH_SUFFIXES):
        return "high", "Government, academic, or primary institutional source."
    if host in _LOW_HOSTS or _is_subdomain_of(host, _LOW_HOSTS):
        return "low", "User-generated or low-accountability platform."
    if host in _MID_HOSTS or _is_subdomain_of(host, _MID_HOSTS):
        return "mid", "Established news outlet or reference work."
    if host.endswith(_MID_SUFFIXES):
        return "mid", "Non-profit or organizational source."
    return "low", "Unverified or independent source; not independently corroborated."


def _is_subdomain_of(host: str, roots: frozenset[str]) -> bool:
    return any(host == root or host.endswith(f".{root}") for root in roots)
