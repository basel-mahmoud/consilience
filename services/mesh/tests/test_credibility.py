import pytest

from mesh import credibility


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://www.nih.gov/news/x", "high"),
        ("https://example.edu/paper", "high"),
        ("https://arxiv.org/abs/1234", "high"),
        ("https://data.gov.uk/dataset", "high"),
        ("https://www.reuters.com/world", "mid"),
        ("https://en.wikipedia.org/wiki/Consilience", "mid"),
        ("https://redcross.org/about", "mid"),
        ("https://someone.substack.com/p/post", "low"),
        ("https://medium.com/@user/post", "low"),
        ("https://reddit.com/r/science", "low"),
        ("https://random-blog.xyz/hot-take", "low"),
    ],
)
def test_credibility_tiers(url, expected):
    tier, rationale = credibility.score(url)
    assert tier == expected
    assert rationale  # always explains itself


def test_subdomain_of_low_platform_is_low():
    tier, _ = credibility.score("https://user.blogspot.com/2026/post")
    assert tier == "low"


def test_malformed_url_is_low_not_crash():
    tier, rationale = credibility.score("not a url")
    assert tier == "low"
    assert rationale


def test_grounding_redirect_uses_domain_hint():
    # Gemini returns a redirect wrapper as the URL; the real domain is the hint
    redirect = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC123"
    assert credibility.score(redirect, domain_hint="ucsb.edu")[0] == "high"
    assert credibility.score(redirect, domain_hint="reuters.com")[0] == "mid"
    assert credibility.score(redirect, domain_hint="someblog.substack.com")[0] == "low"
    # No hint → can't judge the wrapper, defaults low
    assert credibility.score(redirect)[0] == "low"


def test_www_prefix_normalized():
    assert credibility.score("https://www.nature.com/articles/x")[0] == "high"
    assert credibility.score("https://nature.com/articles/x")[0] == "high"
