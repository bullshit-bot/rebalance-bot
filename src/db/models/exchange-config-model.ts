import { Schema, model } from "mongoose";

export interface IExchangeConfig {
  name: "binance" | "okx" | "bybit";
  enabled: boolean;
  apiKeyEnc: string;
  apiSecretEnc: string;
  passphraseEnc: string | null;
  sandbox: boolean;
  createdAt: Date;
}

const exchangeConfigSchema = new Schema<IExchangeConfig>({
  name: { type: String, enum: ["binance", "okx", "bybit"], required: true, unique: true },
  enabled: { type: Boolean, default: true },
  apiKeyEnc: { type: String, required: true },
  apiSecretEnc: { type: String, required: true },
  passphraseEnc: { type: String, default: null },
  sandbox: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const ExchangeConfigModel = model<IExchangeConfig>("ExchangeConfig", exchangeConfigSchema);
export type ExchangeConfig = IExchangeConfig & { _id: string };
export type NewExchangeConfig = Omit<IExchangeConfig, "enabled" | "sandbox" | "createdAt"> & {
  enabled?: boolean;
  sandbox?: boolean;
  createdAt?: Date;
};
