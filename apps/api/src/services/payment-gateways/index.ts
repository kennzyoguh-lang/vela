import type { PaymentProcessor } from "@prisma/client";
import type { PaymentGatewayHandler } from "./types";
import { paystackGateway } from "./paystack.gateway";
import { flutterwaveGateway } from "./flutterwave.gateway";
import { stripeGateway } from "./stripe.gateway";

const registry: Record<PaymentProcessor, PaymentGatewayHandler> = {
  paystack: paystackGateway,
  flutterwave: flutterwaveGateway,
  stripe: stripeGateway,
};

export function getGateway(processor: PaymentProcessor): PaymentGatewayHandler {
  return registry[processor];
}

export type {
  PaymentGatewayHandler,
  InitializePaymentInput,
  InitializePaymentResult,
  VerifiedPaymentEvent,
} from "./types";
