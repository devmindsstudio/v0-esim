// Types
export interface Distributor {
  id: string
  name: string
  company: string
  email: string
  whatsapp: string
  country: string
  countryCode: string
  status: 'active' | 'pending' | 'suspended' | 'dormant'
  walletBalance: number
  esimsSold30d: number
  revenue30d: number
  margin30d: number
  lastActivity: string
  createdAt: string
}

export interface KPIData {
  totalDistributors: number
  activeDistributors: number
  pendingDistributors: number
  suspendedDistributors: number
  totalEsimsSold: number
  totalTopups: number
  grossRevenue: number
  masterMargin: number
  masterCreditPool: number
  allocatedCredit: number
  availableCredit: number
  cancelledEsims: number
}

export interface ActivityEvent {
  id: string
  type: 'credit_allocation' | 'new_child' | 'large_sale' | 'refund' | 'ticket_escalation'
  description: string
  amount?: number
  distributorName?: string
  timestamp: string
}

export interface RevenueData {
  date: string
  revenue: number
  esimsSold: number
}

// Mock Data
export const mockDistributors: Distributor[] = [
  {
    id: '1',
    name: 'Badar Shahzad',
    company: 'TravelTech Solutions',
    email: 'badar@traveltech.com',
    whatsapp: '+971501234567',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    status: 'active',
    walletBalance: 17000,
    esimsSold30d: 156,
    revenue30d: 4680,
    margin30d: 702,
    lastActivity: '2026-05-25T10:30:00Z',
    createdAt: '2025-11-15T09:00:00Z',
  },
  {
    id: '2',
    name: 'Ahmed Al-Rashid',
    company: 'Gulf Mobile Services',
    email: 'ahmed@gulfmobile.ae',
    whatsapp: '+971502345678',
    country: 'Saudi Arabia',
    countryCode: 'SA',
    status: 'active',
    walletBalance: 24500,
    esimsSold30d: 203,
    revenue30d: 6090,
    margin30d: 913,
    lastActivity: '2026-05-25T09:15:00Z',
    createdAt: '2025-10-22T14:00:00Z',
  },
  {
    id: '3',
    name: 'Fatima Hassan',
    company: 'Connect Bahrain',
    email: 'fatima@connectbh.com',
    whatsapp: '+97317890123',
    country: 'Bahrain',
    countryCode: 'BH',
    status: 'active',
    walletBalance: 8750,
    esimsSold30d: 89,
    revenue30d: 2670,
    margin30d: 400,
    lastActivity: '2026-05-24T16:45:00Z',
    createdAt: '2026-01-08T11:30:00Z',
  },
  {
    id: '4',
    name: 'Mohammed Yusuf',
    company: 'Oman Travel Hub',
    email: 'mohammed@omantravelhub.om',
    whatsapp: '+96892345678',
    country: 'Oman',
    countryCode: 'OM',
    status: 'active',
    walletBalance: 12300,
    esimsSold30d: 134,
    revenue30d: 4020,
    margin30d: 603,
    lastActivity: '2026-05-25T08:00:00Z',
    createdAt: '2025-12-03T10:00:00Z',
  },
  {
    id: '5',
    name: 'Sara Al-Kuwaiti',
    company: 'Kuwait SIM Center',
    email: 'sara@kuwaitsim.kw',
    whatsapp: '+96565432109',
    country: 'Kuwait',
    countryCode: 'KW',
    status: 'active',
    walletBalance: 19200,
    esimsSold30d: 178,
    revenue30d: 5340,
    margin30d: 801,
    lastActivity: '2026-05-25T11:00:00Z',
    createdAt: '2025-09-18T13:00:00Z',
  },
  {
    id: '6',
    name: 'Ali Reza',
    company: 'Iran Data Solutions',
    email: 'ali@irandata.ir',
    whatsapp: '+989121234567',
    country: 'Iran',
    countryCode: 'IR',
    status: 'dormant',
    walletBalance: 3200,
    esimsSold30d: 12,
    revenue30d: 420,
    margin30d: 63,
    lastActivity: '2026-05-10T14:30:00Z',
    createdAt: '2026-02-14T09:00:00Z',
  },
  {
    id: '7',
    name: 'Noor Al-Qatari',
    company: 'Doha Mobile',
    email: 'noor@dohamobile.qa',
    whatsapp: '+97444567890',
    country: 'Qatar',
    countryCode: 'QA',
    status: 'active',
    walletBalance: 31500,
    esimsSold30d: 267,
    revenue30d: 8010,
    margin30d: 1201,
    lastActivity: '2026-05-25T07:30:00Z',
    createdAt: '2025-08-05T16:00:00Z',
  },
  {
    id: '8',
    name: 'Hassan Ibrahim',
    company: 'Iraq Connect',
    email: 'hassan@iraqconnect.iq',
    whatsapp: '+9647701234567',
    country: 'Iraq',
    countryCode: 'IQ',
    status: 'pending',
    walletBalance: 5000,
    esimsSold30d: 0,
    revenue30d: 0,
    margin30d: 0,
    lastActivity: '2026-05-23T10:00:00Z',
    createdAt: '2026-05-20T12:00:00Z',
  },
  {
    id: '9',
    name: 'Layla Mahmoud',
    company: 'Jordan Travel SIM',
    email: 'layla@jordantravelsim.jo',
    whatsapp: '+962791234567',
    country: 'Jordan',
    countryCode: 'JO',
    status: 'active',
    walletBalance: 15800,
    esimsSold30d: 145,
    revenue30d: 4350,
    margin30d: 652,
    lastActivity: '2026-05-24T19:00:00Z',
    createdAt: '2025-11-28T08:00:00Z',
  },
  {
    id: '10',
    name: 'Omar Syed',
    company: 'Egypt Mobile Plus',
    email: 'omar@egyptmobile.eg',
    whatsapp: '+201001234567',
    country: 'Egypt',
    countryCode: 'EG',
    status: 'suspended',
    walletBalance: 450,
    esimsSold30d: 0,
    revenue30d: 0,
    margin30d: 0,
    lastActivity: '2026-04-15T12:00:00Z',
    createdAt: '2025-07-10T11:00:00Z',
  },
]

export const mockKPIData: KPIData = {
  totalDistributors: 47,
  activeDistributors: 38,
  pendingDistributors: 5,
  suspendedDistributors: 4,
  totalEsimsSold: 1847,
  totalTopups: 312,
  grossRevenue: 55410,
  masterMargin: 8311,
  masterCreditPool: 250000,
  allocatedCredit: 187450,
  availableCredit: 62550,
  cancelledEsims: 89,
}

export const mockActivityEvents: ActivityEvent[] = [
  {
    id: '1',
    type: 'credit_allocation',
    description: 'Credit allocated to TravelTech Solutions',
    amount: 5000,
    distributorName: 'Badar Shahzad',
    timestamp: '2026-05-25T10:30:00Z',
  },
  {
    id: '2',
    type: 'new_child',
    description: 'New distributor onboarded',
    distributorName: 'Hassan Ibrahim',
    timestamp: '2026-05-23T10:00:00Z',
  },
  {
    id: '3',
    type: 'large_sale',
    description: 'Large order: 50 eSIMs to Europe package',
    amount: 1500,
    distributorName: 'Noor Al-Qatari',
    timestamp: '2026-05-25T07:30:00Z',
  },
  {
    id: '4',
    type: 'refund',
    description: 'Refund processed for cancelled order',
    amount: -45,
    distributorName: 'Fatima Hassan',
    timestamp: '2026-05-24T16:00:00Z',
  },
  {
    id: '5',
    type: 'ticket_escalation',
    description: 'Support ticket escalated: activation issue',
    distributorName: 'Sara Al-Kuwaiti',
    timestamp: '2026-05-24T14:30:00Z',
  },
  {
    id: '6',
    type: 'credit_allocation',
    description: 'Credit allocated to Gulf Mobile Services',
    amount: 10000,
    distributorName: 'Ahmed Al-Rashid',
    timestamp: '2026-05-23T09:00:00Z',
  },
  {
    id: '7',
    type: 'large_sale',
    description: 'Large order: 35 eSIMs to USA package',
    amount: 1050,
    distributorName: 'Mohammed Yusuf',
    timestamp: '2026-05-22T15:45:00Z',
  },
  {
    id: '8',
    type: 'new_child',
    description: 'New distributor onboarded',
    distributorName: 'Egypt Mobile Plus',
    timestamp: '2026-05-20T11:00:00Z',
  },
]

export const mockRevenueData: RevenueData[] = [
  { date: '2026-05-01', revenue: 1850, esimsSold: 62 },
  { date: '2026-05-02', revenue: 2100, esimsSold: 70 },
  { date: '2026-05-03', revenue: 1920, esimsSold: 64 },
  { date: '2026-05-04', revenue: 2340, esimsSold: 78 },
  { date: '2026-05-05', revenue: 2580, esimsSold: 86 },
  { date: '2026-05-06', revenue: 1680, esimsSold: 56 },
  { date: '2026-05-07', revenue: 1440, esimsSold: 48 },
  { date: '2026-05-08', revenue: 2010, esimsSold: 67 },
  { date: '2026-05-09', revenue: 2250, esimsSold: 75 },
  { date: '2026-05-10', revenue: 2490, esimsSold: 83 },
  { date: '2026-05-11', revenue: 2730, esimsSold: 91 },
  { date: '2026-05-12', revenue: 2160, esimsSold: 72 },
  { date: '2026-05-13', revenue: 1560, esimsSold: 52 },
  { date: '2026-05-14', revenue: 1350, esimsSold: 45 },
  { date: '2026-05-15', revenue: 1890, esimsSold: 63 },
  { date: '2026-05-16', revenue: 2070, esimsSold: 69 },
  { date: '2026-05-17', revenue: 2310, esimsSold: 77 },
  { date: '2026-05-18', revenue: 2670, esimsSold: 89 },
  { date: '2026-05-19', revenue: 2910, esimsSold: 97 },
  { date: '2026-05-20', revenue: 1800, esimsSold: 60 },
  { date: '2026-05-21', revenue: 1530, esimsSold: 51 },
  { date: '2026-05-22', revenue: 2040, esimsSold: 68 },
  { date: '2026-05-23', revenue: 2280, esimsSold: 76 },
  { date: '2026-05-24', revenue: 2520, esimsSold: 84 },
  { date: '2026-05-25', revenue: 1950, esimsSold: 65 },
]

export const atRiskDistributors = mockDistributors.filter(
  (d) => d.status === 'dormant' || (d.esimsSold30d < 10 && d.walletBalance > 10)
)
