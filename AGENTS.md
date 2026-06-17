<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The King of Internet — Game Logic

## Crown rule (important)

The crown is awarded based on **total accumulated donations per player within the current season**, not a single donation.

- Each donation adds to that player's **season total**.
- The player with the **highest season total** is the current king.
- If someone passes your total, you can donate again to increase your season total and reclaim the crown.

### Example

1. Player A donates $1,000 → season total $1,000 → Player A is king.
2. Player B donates $1,100 → season total $1,100 → Player B is king.
3. Player A donates $200 more → season total $1,200 → Player A is king again.

## UI data model (mock / future backend)

### Current King

| Field | Description |
|-------|-------------|
| `name` | Current king display name |
| `country` | Player country |
| `seasonTotal` | Total donated this season (determines crown) |
| `latestMessage` | Message from their most recent donation |
| `timeAsKingSeconds` | Time since they last became king |

### Recent King (former crown holder)

| Field | Description |
|-------|-------------|
| `name` | Player name |
| `country` | Player country |
| `seasonTotal` | Their season total when they lost the crown |
| `latestDonation` | Amount of the donation that last changed their standing |
| `message` | Message from that donation |

## Copy

**How It Works:** "Every donation adds to your season total. The player with the highest total becomes the King of Internet. If someone passes your total, you can donate again to reclaim the crown."

Use mock data until payment and persistence are implemented.

