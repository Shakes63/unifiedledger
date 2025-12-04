/**
 * Bill Classification Auto-Suggestion System
 *
 * Analyzes bill names to suggest appropriate classifications and subcategories.
 * Used in the bill form to help users categorize bills quickly and consistently.
 */

export type BillClassification =
  | 'subscription'
  | 'utility'
  | 'housing'
  | 'insurance'
  | 'loan_payment'
  | 'membership'
  | 'service'
  | 'other';

export interface ClassificationSuggestion {
  classification: BillClassification;
  subcategory: string | null;
  confidence: number; // 0-1 scale
  matchedPattern: string;
}

interface PatternConfig {
  patterns: RegExp[];
  subcategories: Record<string, RegExp[]>;
}

// Pattern mappings for auto-suggestion
// Each classification has general patterns and subcategory-specific patterns
const CLASSIFICATION_PATTERNS: Record<BillClassification, PatternConfig> = {
  subscription: {
    patterns: [
      /netflix/i,
      /spotify/i,
      /hulu/i,
      /disney\+?/i,
      /amazon\s?prime/i,
      /hbo/i,
      /apple\s?(music|tv\+?|one|arcade)/i,
      /youtube\s?(premium|music|tv)?/i,
      /paramount\+?/i,
      /peacock/i,
      /max\s?(streaming)?/i,
      /audible/i,
      /kindle\s?unlimited/i,
      /starz/i,
      /showtime/i,
      /crunchyroll/i,
      /funimation/i,
      /espn\+?/i,
      /subscription/i,
      /adobe/i,
      /microsoft\s?365/i,
      /office\s?365/i,
      /dropbox/i,
      /google\s?(one|workspace|drive)/i,
      /icloud/i,
      /notion/i,
      /figma/i,
      /canva/i,
      /grammarly/i,
      /1password/i,
      /lastpass/i,
      /dashlane/i,
      /nordvpn/i,
      /expressvpn/i,
      /surfshark/i,
      /tidal/i,
      /pandora/i,
      /deezer/i,
      /sirius\s?xm/i,
      /xbox\s?(game\s?pass|live)/i,
      /playstation\s?(plus|now)/i,
      /nintendo\s?(online|switch)/i,
      /ea\s?play/i,
      /ubisoft\+?/i,
      /humble/i,
    ],
    subcategories: {
      streaming: [
        /netflix/i,
        /hulu/i,
        /disney\+?/i,
        /hbo/i,
        /youtube\s?(tv|premium)/i,
        /paramount\+?/i,
        /peacock/i,
        /max/i,
        /starz/i,
        /showtime/i,
        /crunchyroll/i,
        /funimation/i,
        /espn\+?/i,
        /apple\s?tv/i,
        /amazon\s?prime\s?video/i,
      ],
      music: [/spotify/i, /apple\s?music/i, /tidal/i, /pandora/i, /deezer/i, /sirius\s?xm/i, /youtube\s?music/i],
      software: [
        /adobe/i,
        /microsoft\s?365/i,
        /office\s?365/i,
        /dropbox/i,
        /google\s?(one|workspace|drive)/i,
        /icloud/i,
        /notion/i,
        /figma/i,
        /canva/i,
        /grammarly/i,
      ],
      security: [/1password/i, /lastpass/i, /dashlane/i, /nordvpn/i, /expressvpn/i, /surfshark/i],
      gaming: [
        /xbox\s?(game\s?pass|live)/i,
        /playstation\s?(plus|now)/i,
        /nintendo\s?(online|switch)/i,
        /ea\s?play/i,
        /ubisoft\+?/i,
        /humble/i,
        /game\s?pass/i,
      ],
      reading: [/audible/i, /kindle\s?unlimited/i, /scribd/i, /medium/i, /substack/i],
    },
  },
  utility: {
    patterns: [
      /electric/i,
      /power\s?(company|bill)?/i,
      /energy/i,
      /gas\s?(bill|company)?/i,
      /natural\s?gas/i,
      /propane/i,
      /water\s?(bill|company)?/i,
      /sewer/i,
      /internet/i,
      /broadband/i,
      /fiber/i,
      /wifi/i,
      /phone\s?(bill|service)?/i,
      /mobile\s?(bill|service)?/i,
      /wireless/i,
      /cell\s?(phone|bill)?/i,
      /verizon/i,
      /at&t/i,
      /t-mobile/i,
      /sprint/i,
      /mint\s?mobile/i,
      /cricket/i,
      /metro\s?pcs/i,
      /comcast/i,
      /xfinity/i,
      /spectrum/i,
      /cox/i,
      /centurylink/i,
      /frontier/i,
      /cable/i,
      /trash/i,
      /garbage/i,
      /waste/i,
      /recycling/i,
      /utility/i,
      /duke\s?energy/i,
      /pge/i,
      /pg&e/i,
      /con\s?edison/i,
      /edison/i,
      /sdg&e/i,
      /sce/i,
      /fpl/i,
      /heating/i,
      /cooling/i,
      /hvac/i,
    ],
    subcategories: {
      electric: [
        /electric/i,
        /power\s?(company|bill)?/i,
        /energy/i,
        /duke\s?energy/i,
        /pge/i,
        /pg&e/i,
        /con\s?edison/i,
        /edison/i,
        /sdg&e/i,
        /sce/i,
        /fpl/i,
      ],
      gas: [/gas\s?(bill|company)?/i, /natural\s?gas/i, /propane/i, /heating/i],
      water: [/water\s?(bill|company)?/i, /sewer/i],
      internet: [
        /internet/i,
        /broadband/i,
        /fiber/i,
        /wifi/i,
        /comcast/i,
        /xfinity/i,
        /spectrum/i,
        /cox/i,
        /centurylink/i,
        /frontier/i,
        /cable/i,
      ],
      phone: [
        /phone\s?(bill|service)?/i,
        /mobile\s?(bill|service)?/i,
        /wireless/i,
        /cell\s?(phone|bill)?/i,
        /verizon/i,
        /at&t/i,
        /t-mobile/i,
        /sprint/i,
        /mint\s?mobile/i,
        /cricket/i,
        /metro\s?pcs/i,
      ],
      waste: [/trash/i, /garbage/i, /waste/i, /recycling/i],
    },
  },
  housing: {
    patterns: [
      /rent/i,
      /mortgage/i,
      /hoa/i,
      /homeowner/i,
      /property\s?(tax|management)?/i,
      /lease/i,
      /apartment/i,
      /condo\s?(fee|association)?/i,
      /home\s?loan/i,
      /housing/i,
      /landlord/i,
      /tenant/i,
      /building\s?fee/i,
      /maintenance\s?fee/i,
      /common\s?area/i,
      /escrow/i,
    ],
    subcategories: {
      rent: [/rent/i, /lease/i, /apartment/i, /landlord/i, /tenant/i],
      mortgage: [/mortgage/i, /home\s?loan/i, /escrow/i],
      hoa: [/hoa/i, /homeowner/i, /condo\s?(fee|association)?/i, /building\s?fee/i, /common\s?area/i, /maintenance\s?fee/i],
      property_tax: [/property\s?tax/i],
    },
  },
  insurance: {
    patterns: [
      /insurance/i,
      /geico/i,
      /state\s?farm/i,
      /progressive/i,
      /allstate/i,
      /liberty\s?mutual/i,
      /nationwide/i,
      /farmers/i,
      /usaa/i,
      /policy/i,
      /premium/i,
      /coverage/i,
      /auto\s?insurance/i,
      /car\s?insurance/i,
      /home\s?insurance/i,
      /renters?\s?insurance/i,
      /health\s?insurance/i,
      /dental\s?insurance/i,
      /vision\s?insurance/i,
      /life\s?insurance/i,
      /pet\s?insurance/i,
      /umbrella/i,
    ],
    subcategories: {
      auto: [/auto\s?insurance/i, /car\s?insurance/i, /vehicle/i, /geico/i, /progressive/i],
      home: [/home\s?insurance/i, /homeowners?/i, /renters?\s?insurance/i, /property\s?insurance/i],
      health: [/health\s?insurance/i, /medical\s?insurance/i, /dental/i, /vision/i],
      life: [/life\s?insurance/i, /term\s?life/i, /whole\s?life/i],
      pet: [/pet\s?insurance/i, /lemonade\s?pet/i, /trupanion/i, /embrace/i],
    },
  },
  loan_payment: {
    patterns: [
      /loan\s?payment/i,
      /student\s?loan/i,
      /car\s?loan/i,
      /auto\s?loan/i,
      /personal\s?loan/i,
      /credit\s?card\s?payment/i,
      /card\s?payment/i,
      /minimum\s?payment/i,
      /navient/i,
      /nelnet/i,
      /sofi/i,
      /great\s?lakes/i,
      /fedloan/i,
      /mohela/i,
      /discover\s?card/i,
      /chase\s?card/i,
      /amex/i,
      /american\s?express/i,
      /capital\s?one/i,
      /citi\s?card/i,
      /wells\s?fargo\s?card/i,
      /bank\s?of\s?america\s?card/i,
      /heloc/i,
      /home\s?equity/i,
      /installment/i,
    ],
    subcategories: {
      student: [/student\s?loan/i, /education\s?loan/i, /navient/i, /nelnet/i, /sofi/i, /great\s?lakes/i, /fedloan/i, /mohela/i],
      auto: [/car\s?loan/i, /auto\s?loan/i, /vehicle\s?loan/i],
      personal: [/personal\s?loan/i, /sofi\s?personal/i, /lending\s?club/i, /prosper/i, /upstart/i],
      credit_card: [
        /credit\s?card\s?payment/i,
        /card\s?payment/i,
        /minimum\s?payment/i,
        /discover\s?card/i,
        /chase\s?card/i,
        /amex/i,
        /american\s?express/i,
        /capital\s?one/i,
        /citi\s?card/i,
      ],
      home_equity: [/heloc/i, /home\s?equity/i],
    },
  },
  membership: {
    patterns: [
      /gym/i,
      /fitness/i,
      /club/i,
      /costco/i,
      /sam's\s?club/i,
      /bj's/i,
      /membership/i,
      /planet\s?fitness/i,
      /la\s?fitness/i,
      /equinox/i,
      /orangetheory/i,
      /crossfit/i,
      /yoga/i,
      /pilates/i,
      /peloton/i,
      /ymca/i,
      /ywca/i,
      /aaa/i,
      /warehouse\s?club/i,
      /professional\s?association/i,
      /union\s?dues/i,
      /country\s?club/i,
      /golf\s?club/i,
      /tennis\s?club/i,
      /swim\s?club/i,
    ],
    subcategories: {
      fitness: [
        /gym/i,
        /fitness/i,
        /planet\s?fitness/i,
        /la\s?fitness/i,
        /equinox/i,
        /orangetheory/i,
        /crossfit/i,
        /yoga/i,
        /pilates/i,
        /peloton/i,
        /ymca/i,
        /ywca/i,
      ],
      warehouse: [/costco/i, /sam's\s?club/i, /bj's/i, /warehouse\s?club/i],
      professional: [/professional\s?association/i, /union\s?dues/i, /bar\s?association/i, /medical\s?association/i],
      club: [/country\s?club/i, /golf\s?club/i, /tennis\s?club/i, /swim\s?club/i],
      roadside: [/aaa/i, /roadside/i],
    },
  },
  service: {
    patterns: [
      /lawn/i,
      /landscaping/i,
      /cleaning/i,
      /maid/i,
      /housekeeping/i,
      /security/i,
      /alarm/i,
      /adt/i,
      /ring\s?protect/i,
      /simplisafe/i,
      /vivint/i,
      /pest\s?control/i,
      /exterminator/i,
      /pool\s?(service|cleaning)?/i,
      /maintenance/i,
      /snow\s?removal/i,
      /plowing/i,
      /tree\s?service/i,
      /handyman/i,
      /childcare/i,
      /daycare/i,
      /nanny/i,
      /dog\s?walking/i,
      /pet\s?sitting/i,
      /tutoring/i,
      /lessons/i,
      /meal\s?(kit|delivery|service)/i,
      /hello\s?fresh/i,
      /blue\s?apron/i,
      /instacart/i,
      /doordash\s?pass/i,
      /uber\s?one/i,
    ],
    subcategories: {
      home: [/lawn/i, /landscaping/i, /cleaning/i, /maid/i, /housekeeping/i, /pool/i, /maintenance/i, /snow\s?removal/i, /handyman/i],
      security: [/security/i, /alarm/i, /adt/i, /ring\s?protect/i, /simplisafe/i, /vivint/i],
      pest: [/pest\s?control/i, /exterminator/i, /termite/i],
      childcare: [/childcare/i, /daycare/i, /nanny/i, /babysitter/i],
      pet: [/dog\s?walking/i, /pet\s?sitting/i, /rover/i, /wag/i],
      education: [/tutoring/i, /lessons/i],
      food_delivery: [/meal\s?(kit|delivery|service)/i, /hello\s?fresh/i, /blue\s?apron/i, /instacart/i, /doordash\s?pass/i, /uber\s?one/i],
    },
  },
  other: {
    patterns: [],
    subcategories: {},
  },
};

// Classification display labels and colors
export const CLASSIFICATION_META: Record<BillClassification, { label: string; color: string; icon: string }> = {
  subscription: { label: 'Subscription', color: '#8b5cf6', icon: 'CreditCard' },
  utility: { label: 'Utility', color: '#f59e0b', icon: 'Zap' },
  housing: { label: 'Housing', color: '#3b82f6', icon: 'Home' },
  insurance: { label: 'Insurance', color: '#10b981', icon: 'Shield' },
  loan_payment: { label: 'Loan Payment', color: '#ef4444', icon: 'Banknote' },
  membership: { label: 'Membership', color: '#ec4899', icon: 'Users' },
  service: { label: 'Service', color: '#06b6d4', icon: 'Wrench' },
  other: { label: 'Other', color: '#6b7280', icon: 'MoreHorizontal' },
};

/**
 * Suggests a classification based on the bill name
 * @param billName - The name/description of the bill
 * @returns ClassificationSuggestion or null if no match found
 */
export function suggestClassification(billName: string): ClassificationSuggestion | null {
  if (!billName || billName.trim().length < 3) {
    return null;
  }

  const normalizedName = billName.trim().toLowerCase();
  let bestMatch: ClassificationSuggestion | null = null;
  let highestConfidence = 0;

  // Check each classification's patterns
  for (const [classification, config] of Object.entries(CLASSIFICATION_PATTERNS)) {
    if (classification === 'other') continue; // Skip 'other' - it's the fallback

    // Check main patterns
    for (const pattern of config.patterns) {
      const match = normalizedName.match(pattern);
      if (match) {
        // Calculate confidence based on match quality
        const matchLength = match[0].length;
        const nameLength = normalizedName.length;
        let confidence = Math.min(0.95, 0.7 + (matchLength / nameLength) * 0.25);

        // Boost confidence for exact service matches (like "Netflix", "Spotify")
        if (matchLength >= 5 && matchLength === nameLength) {
          confidence = 0.98;
        }

        if (confidence > highestConfidence) {
          highestConfidence = confidence;

          // Try to find subcategory
          let subcategory: string | null = null;
          for (const [subcat, subPatterns] of Object.entries(config.subcategories)) {
            for (const subPattern of subPatterns) {
              if (subPattern.test(normalizedName)) {
                subcategory = subcat;
                break;
              }
            }
            if (subcategory) break;
          }

          bestMatch = {
            classification: classification as BillClassification,
            subcategory,
            confidence,
            matchedPattern: pattern.source,
          };
        }
      }
    }
  }

  // Return match if confidence is above threshold
  if (bestMatch && bestMatch.confidence >= 0.7) {
    return bestMatch;
  }

  return null;
}

/**
 * Gets all available classifications with their metadata
 */
export function getAllClassifications(): Array<{
  value: BillClassification;
  label: string;
  color: string;
}> {
  return Object.entries(CLASSIFICATION_META).map(([value, meta]) => ({
    value: value as BillClassification,
    label: meta.label,
    color: meta.color,
  }));
}

/**
 * Gets subcategories for a given classification
 */
export function getSubcategories(classification: BillClassification): string[] {
  const config = CLASSIFICATION_PATTERNS[classification];
  if (!config) return [];
  return Object.keys(config.subcategories);
}

/**
 * Formats a subcategory name for display
 */
export function formatSubcategory(subcategory: string): string {
  return subcategory
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

