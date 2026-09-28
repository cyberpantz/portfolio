<!--
  HALF — the article.

  Everything a reader reads is here, in reading order. Edit freely.

  How it works
  - "=== chapter payout" starts a block. The word after === is the block's
    kind; for chapters, the second word is its id (used in the page URL).
  - "kicker:", "title:", "body:" and so on start a field. A field runs until
    the next field or the next block, so a body can span many lines.
  - In a body, a blank line starts a new paragraph.
  - {name} inserts a number computed from the data. Numbers are never typed
    by hand — the test suite fails if a $ figure or a % appears here. Add a
    new {name} in values.ts. {name|cap} capitalises its first letter.
  - <cite src="id"/> adds a numbered source note. The ids are in
    src/data/half-sources.ts, and every source there must be cited.
  - Plain HTML works: <em> <strong> <b> <i> <a href=""> <br/> <code> <q>
    <sup> <sub> <small> <abbr title="">. <signers/> on its own line draws
    the Pledge signers' table. Anything else fails the test suite.
  - "figure:" names the chart beside a chapter (see FIGURES in Half.tsx).
    "interactive: yes" marks a chart with controls.
-->

=== intro
standfirst:
In 2010, Bill Gates and Warren Buffett asked the world’s billionaires to give away at least half their wealth. Sixteen years later, {pledgers} of the twenty-five richest people have signed. Together they are worth {totalWealth}. Public filings show what some of their foundations pay out — and how little the record shows about the rest.

credit:
Wealth as of {listDate}. Foundation figures come from IRS Form 990-PF and use fair-market asset values. The methodology and source record appear at the end.

pledgers: of the {count} have signed the Pledge
paidOut: paid out of {foundationAssetsShort} held in their foundations, latest filed year
carried: reported as undistributed income carried into the next year
scoredOne: scored one out of five by Forbes; nobody scored three or four


=== pledge-note
trigger: About the Pledge
kicker: The Giving Pledge
title: A promise of half, sixteen years on.
caption: The {signerCount} signers among the twenty-five
body:
Started in 2010 by Bill Gates and Warren Buffett, the Pledge asks the very rich to give away at least half their wealth, in life or at death<cite src="giving-pledge"/>. About {signedPct} percent of American billionaires have signed<cite src="chronicle-pledge"/>. The original American signers who remain billionaires are {signersGrowthPct} percent richer than when they signed; one living original signer has given half<cite src="ips-15"/>.

<signers/>

Elon Musk signed in {muskPledgeYear} worth {muskWealthAtSigning}, and is now worth about {muskGrowth} times that. Peter Thiel says he told him “it would be much worse to give it to Bill Gates”<cite src="fortune-thiel"/>.

Its founders have since changed course. In 2024 Buffett said his gifts to the Gates Foundation would end at his death<cite src="berkshire-2024"/>; in 2025 he wrote that his “grand philanthropic plans … did not prove feasible”<cite src="berkshire-2025"/>; in July 2026 his annual gift left Gates out for the first time in twenty years<cite src="berkshire-2026"/>, closing {buffettToGates} of contributions<cite src="fortune-buffett-gates"/>. Gates will close his foundation in 2045<cite src="npr-gates-2045"/>. Asked “Have they given enough?”, Melinda French Gates said: “No.”<cite src="fortune-french-gates"/>


=== chapter pile
kicker: The twenty-five
title: Between them, {totalWealth}.
figure: WealthPack
body:
The twenty-five richest people alive, as Forbes counted them on {listDate}<cite src="forbes-list"/>.


=== chapter paired
kicker: The public record
title: What they have given, against what they have.
figure: Paired
interactive: yes
body:
The upper bar is the fortune; the lower is lifetime giving as Forbes counts it — money out the door, not into a foundation<cite src="forbes-top-givers"/>. Forbes’ list stops at {giversFloor}. The {boundedCount} Americans absent from it, Elon Musk and Larry Page among them, fall inside the open bar; the {foreignCount} non-Americans are not counted. Share given follows the Institute for Policy Studies’ method<cite src="ips-15"/>. Family scale applies it to a typical family’s {household}<cite src="fed-scf-2022"/>.


=== chapter payout
kicker: The foundations
title: What their foundations distributed last year.
figure: Payout
body:
A private foundation must pay out about five percent of its assets a year, with some carry-over between years<cite src="irs-990pf"/>. Last year the Jensen Huang foundation paid {huangPayout} of its {huangAssets}; Larry Page’s, {pagePayout}; Michael Dell’s, {dellPayout}; the Musk Foundation, {muskPayout}. Four — {shortfall} — carried {carriedForward} of undistributed income into the next year. The median among the country’s 144 billion-dollar foundations was {medianPayout} percent<cite src="ips-2026"/>.


=== chapter mechanisms
kicker: What “given” can mean
title: Three structures that change control, timing and disclosure.
figure: Mechanisms
body:
A gift to a donor-advised fund counts as a foundation payout, yet the fund has no payout rule and need not name its recipients; the Jensen Huang foundation gives mostly to one<cite src="bloomberg-huang"/>. An LLC, like the Chan Zuckerberg Initiative, files no Form 990 at all<cite src="forbes-czi"/>. And a foundation can fund its founder’s own institutions: about half the Musk Foundation’s 2021–22 grants benefited his businesses, associates or family<cite src="nyt-musk-foundation"/>; in 2010 the Walton Family Foundation gave {waltonMuseum} to Crystal Bridges, the family’s museum, and {waltonRegion} to the rest of its home region<cite src="wff-crystal-bridges"/>. The four largest fund sponsors hold {dafHeld} for every dollar they grant<cite src="ips-2026"/>.


=== chapter horizon
kicker: A static projection
title: At last year’s rate, how long would half take?
figure: Horizon
body:
Hold each fortune still, subtract what has been given, and repeat last year’s foundation payout every year. Bill Gates is nearly at half. Michael Bloomberg arrives in {bloombergHalfYear}; Elon Musk, in {muskHalfYear}. An illustration, not a forecast: it ignores investment returns. The axis is logarithmic because the dates are centuries apart.


=== chapter scores
kicker: Forbes’ philanthropy score
title: {topGivers|cap} have given away a fifth or more. {restGivers|cap} have given less than a twentieth.
figure: Scores
body:
Forbes grades giving from one, under 1 percent of a fortune given away, to five, 20 percent or more<cite src="forbes-profiles"/>. It scored the {scoredCount} Americans; the {unscoredCount} others have no score. Measured as share given, they split cleanly. {gapAbove} and the two above him made giving a habit that kept pace with their fortunes; Buffett has given Berkshire shares every year since 2006<cite src="berkshire-2024"/>. Below {gapBelow}, fortunes have outgrown giving: Elon Musk’s is up about {muskGrowth} times since he signed the Pledge. The middle bands are empty because reaching them means giving faster than the fortune grows.


=== chapter coverage
kicker: The limits of disclosure
title: For {darkWealth} of this wealth, no public return shows what is given.
figure: WealthPack disclosure
body:
American private foundations must publish their accounts every year<cite src="irs-990pf"/>. These are the opening circles again, shaded by what that rule reveals. {filedCount|cap} fortunes have a foundation return on file. {ownCount|cap} — {ownNames} — publish only figures of their own. For {noneCount}, among them Steve Ballmer, whose giving runs through a company, this review found no public accounting at all. And a return shows only the foundation: not the LLC, not the donor-advised fund, not the gift made directly. Missing from a chart is not the same as not giving. It is what the record cannot show.


=== notes
kicker: How to read the record
title: What the record shows, and what it does not.


=== note
heading: Giving is not absent
body:
Warren Buffett has given away {buffettGiven}<cite src="forbes-top-givers"/>, Bill Gates {gatesGiven}, Michael Bloomberg {bloombergGiven}. Sergey Brin’s foundation paid out {brinPayout} last year<cite src="irs-990pf"/>, more than three times the requirement. The Pledge’s founders account for most of the documented giving here.


=== note
heading: The five-percent rule
body:
Paying less than five percent in a year is legal if the balance follows the next year<cite src="irs-990pf"/>. Donor-advised funds and LLCs are legal. The only court ruling on foundation self-dealing cited here concerns someone outside the twenty-five<cite src="nyag-trump"/>. The filings show what the rules allow, not misconduct.


=== note
heading: Attributing Bezos giving
body:
The only Bezos foundation that files is his parents’; its figures are not counted as his. His own vehicle reported no grants and {bezosEarthExpenses} of expenses in its latest return<cite src="propublica-bezos-earth"/>. His one lifetime figure, {bezosGiven} against {bezosWealth}<cite src="forbes-top-givers"/>, appears only in the giving chart.


=== note
heading: The public subsidy
body:
A gift of appreciated stock can avoid capital-gains tax and earn an income-tax deduction<cite src="tpc-subsidy"/>. The Institute for Policy Studies puts the public’s share at up to {subsidy} on the dollar for the richest donors<cite src="ips-15"/>. Part of every gift here is paid for in taxes not collected.


=== method
term: The list
body: Forbes’ real-time ranking on {listDate}. Ranks move daily; the date is the fact.

=== method
term: Payout rate
body: Qualifying distributions divided by the fair-market value of assets, both from the same year’s Form 990-PF. Book values were rejected: they understate assets several-fold, and made one foundation appear to pay out more than it held.

=== method
term: Years to half
body: Half the fortune, less lifetime giving, divided by the latest year’s payout. A rate carried forward, not a forecast.

=== method
term: Attribution
body: Two judgements are made in the build script, where they can be read: the Bezos Family Foundation is not his giving, and the Buffett filing was read from the IRS e-file and counts as primary.

=== method
term: Status
body: Every source is graded. Nothing seen only in a search summary draws a bar. The full register — every URL the research touched — is <code>docs/research/half/SOURCES.md</code>.

=== method
term: Built
body: {built}, by <code>scripts/half-data.mjs</code>.
