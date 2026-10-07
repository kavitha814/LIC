export interface LICPlanInfo {
  tableNo: string;
  name: string;
  category: 'Endowment' | 'Whole Life' | 'Money Back' | 'Term' | 'Pension' | 'Unit Linked' | 'Health';
  typicalTerms: number[];
  minSumAssured: number;
  description: string;
}

export const LIC_POPULAR_PLANS: LICPlanInfo[] = [
  {
    tableNo: '914',
    name: 'New Endowment Plan',
    category: 'Endowment',
    typicalTerms: [12, 15, 20, 25, 30, 35],
    minSumAssured: 100000,
    description: 'Traditional participating endowment assurance plan with death and maturity benefits.'
  },
  {
    tableNo: '915',
    name: 'New Jeevan Anand',
    category: 'Endowment',
    typicalTerms: [15, 20, 25, 30, 35],
    minSumAssured: 100000,
    description: 'Double benefit plan: Maturity sum assured plus lifetime financial protection.'
  },
  {
    tableNo: '936',
    name: 'Jeevan Labh',
    category: 'Endowment',
    typicalTerms: [16, 21, 25],
    minSumAssured: 200000,
    description: 'Limited premium paying endowment plan with high bonus returns.'
  },
  {
    tableNo: '945',
    name: 'Jeevan Umang',
    category: 'Whole Life',
    typicalTerms: [15, 20, 25, 30],
    minSumAssured: 200000,
    description: 'Guaranteed 8% annual survival benefit after PPT till age 100.'
  },
  {
    tableNo: '868',
    name: 'Bima Jyoti',
    category: 'Endowment',
    typicalTerms: [15, 16, 17, 18, 19, 20],
    minSumAssured: 100000,
    description: 'Guaranteed addition of Rs 50 per thousand sum assured every year.'
  },
  {
    tableNo: '920',
    name: 'New 20-Year Money Back',
    category: 'Money Back',
    typicalTerms: [20],
    minSumAssured: 100000,
    description: 'Periodic survival benefits of 20% each at end of 5th, 10th & 15th year.'
  },
  {
    tableNo: '855',
    name: 'Tech Term',
    category: 'Term',
    typicalTerms: [10, 15, 20, 25, 30, 35, 40],
    minSumAssured: 5000000,
    description: 'Pure risk cover term assurance for comprehensive family security.'
  },
  {
    tableNo: '849',
    name: 'Nivesh Plus',
    category: 'Unit Linked',
    typicalTerms: [10, 15, 20, 25],
    minSumAssured: 125000,
    description: 'Single premium unit-linked life insurance savings plan.'
  },
  {
    tableNo: '948',
    name: 'Shanti / Saral Pension',
    category: 'Pension',
    typicalTerms: [1],
    minSumAssured: 100000,
    description: 'Immediate annuity plan for lifelong guaranteed pension income.'
  }
];
