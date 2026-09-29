const mockGetTotalSupply = jest.fn();
const mockGetFeeRate = jest.fn();

jest.mock("../../config/database", () => ({
  prisma: {
    kycValidatorReward: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("../../config/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("../contracts", () => ({
  acbuMintingService: {
    getTotalSupply: mockGetTotalSupply,
    getFeeRate: mockGetFeeRate,
  },
}));

import { validateRewardAmount } from "./kycValidatorRewardService";

describe("kycValidatorRewardService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("caps validator rewards against on-chain total supply, not fee rate", async () => {
    mockGetTotalSupply.mockResolvedValue("100000000000");
    mockGetFeeRate.mockResolvedValue(25);

    const result = await validateRewardAmount("10000000");

    expect(mockGetTotalSupply).toHaveBeenCalledTimes(1);
    expect(mockGetFeeRate).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      valid: true,
      onChainTotalMinted: "100000000000",
      rewardAmount: "10000000",
    });
  });

  it("rejects rewards when on-chain total supply is zero", async () => {
    mockGetTotalSupply.mockResolvedValue("0");

    await expect(validateRewardAmount("1")).resolves.toMatchObject({
      valid: false,
      reason: "On-chain mint total is zero - cannot verify reward",
    });
  });
});
