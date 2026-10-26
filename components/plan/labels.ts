export * from '@/shared/labels/plan';

/**
 * A larger hit area around a small control (a 16-20px tick box, a switch) without changing how it
 * looks: an invisible ::after that reaches 44px, the minimum comfortable tap target.
 */
export const TAP_TARGET = "relative after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";
