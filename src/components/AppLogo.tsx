import { APP_NAME } from "../config";

interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const textSizes = {
  sm: "text-sm",
  md: "text-[0.9375rem]",
  lg: "text-lg",
};

export function AppLogo({ size = "md", className = "" }: Props) {
  return (
    <span
      className={`text-primary font-semibold tracking-tight ${textSizes[size]} ${className}`}
    >
      {APP_NAME}
    </span>
  );
}
