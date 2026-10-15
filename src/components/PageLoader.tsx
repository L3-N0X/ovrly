import { Loader2 } from "lucide-react";

// Centred in the viewport rather than the page, so the spinner stays put when one loading
// step hands over to the next (the route guard's session check, then the page's own data).
const PageLoader = () => (
  <div
    role="status"
    aria-label="Loading"
    className="pointer-events-none fixed inset-0 flex items-center justify-center text-muted-foreground"
  >
    <Loader2 className="size-6 animate-spin" />
  </div>
);

export default PageLoader;
