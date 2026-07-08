"""Research lenses — the distinct angles each parallel agent takes.

Independent vantage points are the point of the mesh: three agents told to
approach the same question differently surface different sources, and where
they nevertheless agree the evidence is stronger. Contradiction detection
(M3b) operates over the claims these lenses produce.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Lens:
    key: str
    label: str
    guidance: str


LENSES: tuple[Lens, ...] = (
    Lens(
        key="primary",
        label="Primary evidence",
        guidance=(
            "Prioritize primary sources: official data, original research, "
            "regulatory filings, and direct statements. Prefer .gov, .edu, and "
            "peer-reviewed sources over commentary."
        ),
    ),
    Lens(
        key="analysis",
        label="Expert analysis",
        guidance=(
            "Prioritize expert synthesis and reputable journalism that explains "
            "and contextualizes the evidence. Favor established outlets and "
            "domain experts over raw data."
        ),
    ),
    Lens(
        key="skeptical",
        label="Skeptical review",
        guidance=(
            "Actively seek counterevidence, limitations, dissenting expert views, "
            "and reasons the mainstream answer might be wrong or overstated. "
            "Surface disagreements rather than smoothing them over."
        ),
    ),
)


def default_lenses(count: int | None = None) -> tuple[Lens, ...]:
    if count is None:
        return LENSES
    return LENSES[: max(1, min(count, len(LENSES)))]
