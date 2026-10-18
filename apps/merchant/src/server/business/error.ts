import { CounterError } from "@mi-pasaporte/domain/server/counter/core";
export type BusinessErrorMetadata = {
  fields?: { salesMassUnits: string };
  products?: { id: string; name: string; pricingUnit: string }[];
};
export class BusinessError extends CounterError {
  constructor(
    status: number,
    code: string,
    message: string,
    readonly metadata?: BusinessErrorMetadata,
  ) {
    super(status, code, message);
  }
}
