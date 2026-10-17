/** POS consumes core metadata and validation; it owns neither methods nor initialization. */
export {
  listPaymentMethods,
  paymentMethodsForClose,
  type PaymentMethod,
  type PaymentShape,
} from "../../../server/business/payment-methods";
