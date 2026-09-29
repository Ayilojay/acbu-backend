import { prisma } from "../../config/database";
import { reserveWalletVersion } from "./walletStateService";

jest.mock("../../config/database", () => ({
  prisma: {
    user: {
      updateMany: jest.fn(),
    },
  },
}));

const mockUpdateMany = prisma.user.updateMany as jest.Mock;

describe("reserveWalletVersion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("increments wallet version when If-Match matches", async () => {
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await expect(reserveWalletVersion("user-1", '"4"')).resolves.toBe(5);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: "user-1", walletVersion: 4 },
      data: { walletVersion: { increment: 1 } },
    });
  });

  it("returns 412 when the wallet version changed concurrently", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });

    await expect(reserveWalletVersion("user-1", '"4"')).rejects.toMatchObject({
      statusCode: 412,
      code: "PRECONDITION_FAILED",
    });
  });
});
