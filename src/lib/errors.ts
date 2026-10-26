export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const assert = (
  condition: unknown,
  status = 403,
  message = 'Bu işlem için yetkiniz bulunmuyor.',
): asserts condition => {
  if (!condition) throw new AppError(status, message);
};
