/** Attached to `req.user` after JWT validation. */
export interface JwtUser {
  userId: string;
}
