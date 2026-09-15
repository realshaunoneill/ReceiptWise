'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  BarChart3,
  CreditCard,
  Users,
  ArrowRight,
  CheckCircle2,
  ScanLine,
  Layers,
  Shield,
  ChevronLeft,
  Receipt,
  Check,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from '@/lib/utils/currency';

type PricingDetails = {
  monthly: {
    priceId: string;
    amount: number;
    currency: string;
    interval: string;
    intervalCount: number;
    productName: string;
    productDescription: string | null;
    active: boolean;
  };
  annual: {
    priceId: string;
    amount: number;
    currency: string;
    interval: string;
    intervalCount: number;
    productName: string;
    productDescription: string | null;
    active: boolean;
  } | null;
};

type OnboardingStep = {
  id: number;
  title: string;
  description: string;
  icon: typeof Upload;
  color: string;
  bgColor: string;
  features?: Array<{ icon: typeof Upload; text: string }>;
  pricing?: boolean;
  cta?: boolean;
  currencySelect?: boolean;
};

/*
 * Seven steps of the tour.
 *
 * Four of the titles ended in ✨, one in 🎉 and one in 🎁 — a decoration applied
 * to whichever headings happened to be about features, in a dialog that is the
 * first thing a new customer sees. Each step also carried its own `color`, so the
 * icon changed hue from emerald to orange to blue to green to purple as you
 * clicked Next, which reads as six unrelated products rather than a tour of one.
 * Every step is now the primary colour, and each mentioned "Included in free
 * trial" as its fourth bullet — the trial is stated in the step that sells it,
 * not four times before then.
 */
const onboardingSteps: OnboardingStep[] = [
  {
    id: 1,
    title: 'Welcome to ReceiptWise',
    description: 'An expense tracker built around receipts, and around households that share them.',
    icon: Receipt,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    features: [
      { icon: Users, text: 'Shared with family, a partner or flatmates' },
      { icon: ScanLine, text: 'Receipts read and itemised for you' },
      { icon: BarChart3, text: 'Spending broken down by category' },
      { icon: Shield, text: 'Your data, exportable and deletable' },
    ],
  },
  {
    id: 2,
    title: 'Pick your currency',
    description: 'This is the currency every amount in the app is shown in. You can change it later.',
    icon: Globe,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    currencySelect: true,
  },
  {
    id: 3,
    title: 'Households',
    description: 'A household is a shared receipt pile. Anyone in it can add to it, and everyone sees the same picture.',
    icon: Users,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    features: [
      { icon: Users, text: 'As many members as you need' },
      { icon: Upload, text: 'Everyone can add receipts' },
      { icon: BarChart3, text: 'Combined spending, and who spent it' },
      { icon: Layers, text: 'Keep personal receipts separate if you want' },
    ],
  },
  {
    id: 4,
    title: 'Adding receipts',
    description: 'Photograph the paper, upload a PDF, or clip an online receipt from your browser.',
    icon: Upload,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    features: [
      { icon: Upload, text: 'Camera, file upload, or browser extension' },
      { icon: ScanLine, text: 'Merchant, date, total, tax and line items' },
      { icon: Layers, text: 'Drop a whole stack in at once' },
      { icon: CheckCircle2, text: 'Sorted into a category automatically' },
    ],
  },
  {
    id: 5,
    title: 'Subscriptions',
    description: 'The recurring payments that are easy to forget about, tracked next to the receipts that prove them.',
    icon: CreditCard,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    features: [
      { icon: CreditCard, text: 'Every recurring payment in one list' },
      { icon: Users, text: 'Split costs across the household' },
      { icon: CheckCircle2, text: 'Link a receipt to the payment it covers' },
      { icon: BarChart3, text: 'See what is due next' },
    ],
  },
  {
    id: 6,
    title: 'Insights',
    description: 'Where the money went, over the week, the month or the year.',
    icon: BarChart3,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    features: [
      { icon: BarChart3, text: 'Trends over the period you choose' },
      { icon: Users, text: 'Who in the household spent what' },
      { icon: ScanLine, text: 'A written summary of the period' },
      { icon: CheckCircle2, text: 'Item history down to the line' },
    ],
  },
  {
    id: 7,
    title: 'Subscribing',
    description: 'That is the tour. Adding receipts and everything built on them needs a subscription.',
    icon: CreditCard,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    pricing: true,
    cta: true,
  },
];

type OnboardingTourProps = {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
};

export function OnboardingTour({ open, onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pricingDetails, setPricingDetails] = useState<PricingDetails | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState(DEFAULT_CURRENCY);

  // Fetch pricing details when component mounts and dialog is open
  useEffect(() => {
    if (!open) return;

    const fetchPricing = async () => {
      try {
        const response = await fetch('/api/pricing');
        if (!response.ok) {
          throw new Error('Failed to fetch pricing');
        }
        const data = await response.json();
        setPricingDetails(data);
      } catch (error) {
        console.error('Error fetching pricing:', error);
        toast.error('Failed to load pricing information.');
      } finally {
        setIsLoadingPrice(false);
      }
    };

    fetchPricing();
  }, [open]);

  // Reset step when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setIsProcessing(false);
    }
  }, [open]);

  const step = onboardingSteps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === onboardingSteps.length - 1;

  // Format currency
  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Save currency preference
  const saveCurrency = async () => {
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: selectedCurrency }),
      });
      if (!response.ok) {
        throw new Error('Failed to save currency');
      }
    } catch (error) {
      console.error('Error saving currency:', error);
      // Don't block the flow, just log the error
    }
  };

  const handleNext = async () => {
    // If we're on the currency step, save the currency preference
    if (step.currencySelect) {
      await saveCurrency();
    }

    if (isLastStep) {
      // Last step is pricing, which has its own CTAs
      // This shouldn't be called for the pricing step
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = async () => {
    await onSkip();
  };

  const handleStartTrial = async () => {
    setIsProcessing(true);
    try {
      // Use annual price if available, otherwise monthly
      const priceId = pricingDetails?.annual?.priceId || pricingDetails?.monthly?.priceId;

      if (!priceId) {
        throw new Error('No pricing information available');
      }

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();

      if (data.url) {
        // Complete onboarding before redirecting
        await onComplete();
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setIsProcessing(false);
    }
  };

  const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS ? parseInt(process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS) : 0;

  // Annual saving, derived from the two live prices rather than asserted.
  const annualSavingPercent =
    pricingDetails?.monthly && pricingDetails.annual
      ? Math.round(
        ((pricingDetails.monthly.amount * 12 - pricingDetails.annual.amount) /
            (pricingDetails.monthly.amount * 12)) *
            100,
      )
      : null;

  const handleClose = async () => {
    await handleSkip();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <DialogContent
        className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">
          {step.title} - ReceiptWise Onboarding
        </DialogTitle>

        <div className="relative">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: '0%' }}
              animate={{ width: `${((currentStep + 1) / onboardingSteps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="p-4 sm:p-8 pt-8 sm:pt-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Icon */}
                <div className={cn('w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center', step.bgColor)}>
                  <Icon className={cn('w-6 h-6 sm:w-8 sm:h-8', step.color)} />
                </div>

                {/* Title and Description */}
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{step.title}</h2>
                  <p className="text-muted-foreground text-base sm:text-lg">{step.description}</p>
                </div>

                {/* Features */}
                {step.features && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 py-4">
                    {step.features.map((feature, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-muted/50"
                      >
                        <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-xs sm:text-sm font-medium">{feature.text}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Currency Selection */}
                {step.currencySelect && (
                  <div className="py-4 space-y-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <label className="text-sm font-medium">Select your currency</label>
                      <Select
                        value={selectedCurrency}
                        onValueChange={(value) => setSelectedCurrency(value as CurrencyCode)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORTED_CURRENCIES.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              {currency.symbol} {currency.code} - {currency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        This will be used to display amounts in your dashboard and reports. You can change this later in Settings.
                        {/* Was support@receiptwise.app; the domain is receiptwise.io. */}
                        Missing yours? <a href="mailto:support@receiptwise.io?subject=Currency%20request" className="text-primary hover:underline">Ask us to add it</a>.
                      </p>
                    </motion.div>
                  </div>
                )}

                {/* Pricing Section */}
                {step.pricing && (
                  <div className="space-y-4 py-4">
                    {trialDays > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg border border-success/25 bg-success/10 p-3 text-center"
                      >
                        <p className="text-sm font-medium text-success">
                          Nothing is charged for {trialDays} days.
                        </p>
                      </motion.div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative p-6 rounded-lg border-2 border-primary bg-linear-to-br from-primary/5 to-primary/10"
                    >
                      <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                        Premium
                      </Badge>

                      <div className="text-center space-y-4 mt-2">
                        <div>
                          {isLoadingPrice ? (
                            <div className="space-y-2">
                              <Skeleton className="h-12 w-32 mx-auto" />
                              <Skeleton className="h-4 w-24 mx-auto" />
                            </div>
                          ) : pricingDetails ? (
                            <>
                              {pricingDetails.annual ? (
                                <>
                                  <div className="text-4xl font-bold text-primary">
                                    {formatPrice(pricingDetails.annual.amount / 12, pricingDetails.annual.currency)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    per month
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {formatPrice(pricingDetails.annual.amount, pricingDetails.annual.currency)} billed annually
                                  </div>
                                  {/* Was a flat "Save 2 months (17% off)" — asserted
                                      regardless of the two prices actually configured.
                                      Computed from them instead. */}
                                  {annualSavingPercent !== null && annualSavingPercent > 0 && (
                                    <Badge variant="secondary" className="mt-2">
                                      {annualSavingPercent}% cheaper than monthly
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className="text-4xl font-bold text-primary">
                                    {formatPrice(pricingDetails.monthly.amount, pricingDetails.monthly.currency)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    per {pricingDetails.monthly.interval}
                                  </div>
                                </>
                              )}
                            </>
                          ) : (
                            /*
                              Was a hardcoded "€1.66 / €19.99 billed annually"
                              fallback for when the pricing call fails. Quoting a
                              made-up figure on a checkout screen is worse than
                              quoting none: the landing page carried its own
                              hardcoded pair (€4.99 and €39.99) which had drifted
                              to two and a half times the real Stripe price. If we
                              cannot read the price, we say so and let Stripe show
                              it.
                            */
                            <p className="text-sm text-muted-foreground">
                              We could not load the current price just now. It is shown before
                              you confirm anything at checkout.
                            </p>
                          )}
                        </div>

                        <div className="space-y-2 text-left">
                          {/* "Subscription tracking & reminders" — there are no
                              reminders, no notification of any kind is sent. */}
                          {[
                            'Unlimited receipts, all of them scanned',
                            'Unlimited households',
                            'Spending analytics and insights',
                            'Subscription tracking',
                            'Export everything, any time',
                            'Priority support',
                          ].map((feature) => (
                            <div key={feature} className="flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                              <span className="text-sm">{feature}</span>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2 pt-2">
                          <Button
                            onClick={handleStartTrial}
                            disabled={isProcessing}
                            size="lg"
                            className="w-full"
                          >
                            {isProcessing ? (
                              <div className="flex items-center gap-2">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                <span>Processing...</span>
                              </div>
                            ) : trialDays > 0 ? (
                              <>
                                <CreditCard className="h-4 w-4" aria-hidden="true" />
                                Start the {trialDays}-day trial
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4" aria-hidden="true" />
                                Subscribe
                              </>
                            )}
                          </Button>

                          <Button
                            onClick={() => handleSkip()}
                            disabled={isProcessing}
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground"
                          >
                            Maybe later
                          </Button>
                        </div>

                        <p className="text-center text-xs text-muted-foreground">
                          {trialDays > 0
                            ? `${trialDays} days free, full access, cancel any time before it ends.`
                            : 'Cancel any time.'}
                        </p>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* Step indicators */}
                <div className="flex justify-center gap-2 py-4">
                  {onboardingSteps.map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'h-2 rounded-full transition-all duration-300',
                        index === currentStep
                          ? 'w-8 bg-primary'
                          : index < currentStep
                          ? 'w-2 bg-primary/50'
                          : 'w-2 bg-muted',
                      )}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 sm:gap-4 pt-4">
                  <div className="flex items-center gap-2">
                    {currentStep > 0 && (
                      <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={isProcessing}
                        size="sm"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        <span className="hidden sm:inline">Back</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => handleSkip()}
                      disabled={isProcessing}
                      size="sm"
                    >
                      Skip tutorial
                    </Button>
                  </div>
                  {!step.pricing && (
                    <Button
                      onClick={handleNext}
                      size="sm"
                      className="min-w-24 sm:min-w-32"
                    >
                      {isLastStep ? 'Get Started' : 'Next'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
