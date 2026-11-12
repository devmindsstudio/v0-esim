'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, User, Building2, Mail, Lock, Phone, Globe } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { type NewDistributorInput } from '@/lib/distributors-store'

const COUNTRIES = [
  { label: 'United Arab Emirates', code: 'AE' },
  { label: 'Saudi Arabia', code: 'SA' },
  { label: 'Bahrain', code: 'BH' },
  { label: 'Kuwait', code: 'KW' },
  { label: 'Oman', code: 'OM' },
  { label: 'Qatar', code: 'QA' },
  { label: 'Jordan', code: 'JO' },
  { label: 'Egypt', code: 'EG' },
  { label: 'Iraq', code: 'IQ' },
  { label: 'Iran', code: 'IR' },
  { label: 'Other', code: 'XX' },
]

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  company: z.string().min(2, 'Company name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  whatsapp: z
    .string()
    .min(7, 'Please enter a valid WhatsApp number')
    .regex(/^\+?[0-9\s\-()]+$/, 'Only digits, spaces, +, -, ( ) are allowed'),
  countryCode: z.string().min(2, 'Please select a country'),
})

type FormValues = z.infer<typeof formSchema>

interface AddDistributorFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: NewDistributorInput) => Promise<boolean>
  /** Wording overrides so this form can be reused for sub-distributors too. */
  title?: string
  description?: React.ReactNode
  submitLabel?: string
  submittingLabel?: string
}

const DEFAULT_DESCRIPTION = (
  <>
    Fill in the details below. The distributor will be added with a{' '}
    <span className="font-semibold text-yellow-600">Pending</span> status — activate them
    from the table once reviewed.
  </>
)

export function AddDistributorForm({
  open,
  onOpenChange,
  onSubmit,
  title = 'Add New Distributor',
  description = DEFAULT_DESCRIPTION,
  submitLabel = 'Add Distributor',
  submittingLabel = 'Adding…',
}: AddDistributorFormProps) {
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      password: '',
      whatsapp: '',
      countryCode: '',
    },
  })

  async function handleSubmit(values: FormValues) {
    const country = COUNTRIES.find((c) => c.code === values.countryCode)
    // The parent calls the server and returns true only if it actually succeeded.
    const ok = await onSubmit({
      name: values.name,
      company: values.company,
      email: values.email,
      password: values.password,
      whatsapp: values.whatsapp,
      country: country?.label ?? values.countryCode,
      countryCode: values.countryCode,
    })
    // Only clear + close the form when the distributor was really created.
    if (ok) {
      form.reset()
      onOpenChange(false)
    }
  }

  function handleCancel() {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b">
          <DialogHeader>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <DialogDescription className="mt-1">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="px-8 py-6 space-y-8">

            {/* Section: Personal Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Personal Information
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Ahmed Al-Rashid" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Building2 className="size-3.5 inline mr-1 mb-0.5" />
                        Company Name
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Gulf Mobile Services" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Phone className="size-3.5 inline mr-1 mb-0.5" />
                        WhatsApp Number
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="+971501234567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="countryCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Globe className="size-3.5 inline mr-1 mb-0.5" />
                        Country
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Section: Portal Access */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Portal Access
                </h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                These credentials will be used by the distributor to log in to their portal once it is ready.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Mail className="size-3.5 inline mr-1 mb-0.5" />
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="ahmed@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Min. 8 chars, 1 uppercase, 1 number"
                            className="pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? submittingLabel : submitLabel}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
