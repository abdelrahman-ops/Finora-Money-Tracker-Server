import { Wallet, IWallet } from './model';
import { AppError } from '../../common/utils/AppError';

export class WalletService {
  async findAll(userId: string) {
    return Wallet.find({ userId }).sort({ createdAt: 1 }).lean();
  }

  async findById(userId: string, id: string) {
    const wallet = await Wallet.findOne({ _id: id, userId }).lean();
    if (!wallet) throw new AppError('Wallet not found', 404);
    return wallet;
  }

  async create(userId: string, data: Partial<IWallet>) {
    return Wallet.create({ ...data, userId });
  }

  async update(userId: string, id: string, data: Partial<IWallet>) {
    const wallet = await Wallet.findOneAndUpdate(
      { _id: id, userId },
      { $set: data },
      { new: true, runValidators: true },
    ).lean();
    if (!wallet) throw new AppError('Wallet not found', 404);
    return wallet;
  }

  async delete(userId: string, id: string) {
    const result = await Wallet.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) throw new AppError('Wallet not found', 404);
  }
}
