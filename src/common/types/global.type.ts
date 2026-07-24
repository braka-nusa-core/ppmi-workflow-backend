export type SuccessResponse = {
  success: true;
  message?: string;
  data?: unknown;
};

export type ErrorResponse = {
  success: false;
  error: {
    name: string;
    message: string;
    details?: unknown;
  };
};
