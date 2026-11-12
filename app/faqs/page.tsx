import type { Metadata } from 'next'
import { Wifi, Store } from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { PublicShell, CtaBand } from '@/components/marketing/public-shell'

export const metadata: Metadata = {
  title: 'eTijwaal FAQs | eSIM & Distributor Questions',
  description:
    'Answers to common questions about eTijwaal eSIMs — compatibility, installation, activation — and about reselling through the distributor portal.',
}

const esimFaqs = [
  {
    q: 'What is an eSIM?',
    a: "An eSIM is a digital SIM embedded in your phone. You install a data plan by scanning a QR code, so there's no physical card to insert or swap.",
  },
  {
    q: 'Is my phone eSIM-compatible?',
    a: "Most phones released in the last few years support eSIM — recent iPhones, Samsung Galaxy, Google Pixel and more. Look for an 'Add eSIM' or 'Add data plan' option in your settings, or ask your distributor.",
  },
  {
    q: 'How do I install my eSIM?',
    a: "After purchase you'll receive a QR code by email. Go to your phone's mobile-data settings, choose 'Add eSIM', and scan the code — installation takes seconds.",
  },
  {
    q: 'When should I activate my plan?',
    a: 'You can install any time, but activate when you reach your destination (or just before). Many plans begin counting data from first use or first network connection.',
  },
  {
    q: 'Do I need to remove my regular SIM?',
    a: 'No. The eSIM works alongside your normal SIM, so you keep your usual number for calls and texts while using eSIM data abroad.',
  },
  {
    q: 'What happens when my data runs out?',
    a: 'Simply buy another package. Your distributor can issue a new eSIM in minutes.',
  },
  {
    q: 'Which countries are covered?',
    a: 'eTijwaal offers eSIM plans for 200+ countries and regions worldwide, delivered through major telecom partners.',
  },
]

const distributorFaqs = [
  {
    q: 'How do I add credit to my wallet?',
    a: "Your master admin allocates credit to your distributor wallet. Any bonus percentage you've been given is added automatically on top-up.",
  },
  {
    q: 'How is my profit calculated?',
    a: 'You have two figures: top-up profit (the bonus credit you receive when your wallet is funded) and selling profit (your sale price minus the eSIM cost). Both are shown on your dashboard for any date range.',
  },
  {
    q: 'Can I set my own selling price?',
    a: 'Yes. You choose the price you charge your customer for each order. The portal blocks selling below your cost so you never make a loss.',
  },
  {
    q: 'How does my customer receive the eSIM?',
    a: "When you place an order, the eSIM's QR code is emailed to your customer automatically, ready to scan and install.",
  },
  {
    q: 'Can I add sub-distributors?',
    a: 'Yes. Distributors can add sub-distributors, allocate them credit, and see their sales included in your totals.',
  },
  {
    q: 'Who do I contact for support?',
    a: 'eTijwaal provides 24/7 customer support. For portal or account questions, reach out to your master admin.',
  },
]

function FaqGroup({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof Wifi
  title: string
  items: { q: string; a: string }[]
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      </div>
      <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
        {items.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger className="text-base font-medium hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

export default function FaqsPage() {
  return (
    <PublicShell
      title="Frequently Asked Questions"
      subtitle="Everything you need to know about eTijwaal eSIMs and reselling them through the distributor portal."
    >
      <div className="mx-auto max-w-3xl space-y-12">
        <FaqGroup icon={Wifi} title="About eSIMs" items={esimFaqs} />
        <FaqGroup icon={Store} title="For distributors" items={distributorFaqs} />
      </div>

      <CtaBand
        heading="Still have questions?"
        body="Sign in to the portal to get started, or reach out to your admin for anything else."
      />
    </PublicShell>
  )
}
