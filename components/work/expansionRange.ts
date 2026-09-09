/** Floor for the scroll-scrub expansion travel (px). Shared by
 *  PortfolioExperience's gap gestures and WorkExperience's card scrub; kept in
 *  its own module so the landing chunk can read it without pulling in the
 *  dynamically-split work subtree. */
export const MIN_EXPANSION_RANGE_PX = 96
