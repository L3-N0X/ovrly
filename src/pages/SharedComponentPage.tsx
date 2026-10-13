import React, { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, Blocks, Check, Info, Layers, Link2Off, Loader2, Plus } from "lucide-react";
import { Avatar } from "@/components/home/AvatarStack";
import ComponentPreview from "@/components/library/ComponentPreview";
import { Button } from "@/components/ui/button";
import { TwitchIcon } from "@/components/icons/TwitchIcon";
import { authClient } from "@/lib/auth-client";
import { useTwitchSignIn } from "@/lib/hooks/useTwitchSignIn";
import {
  COMPONENTS_QUERY_KEY,
  addSharedComponent,
  countComponentElements,
  droppedImagesMessage,
  fetchSharedComponent,
  sharedComponentPath,
  type SavedComponent,
} from "@/lib/components";

const MY_COMPONENTS = "/?view=components";

// Where a component shared by link opens (ShareComponentDialog): a preview, and one click to
// add a copy to your own components. Signing in from here comes back with `?add=1`, which adds
// it right away, since that's what the click was for.
const SharedComponentPage: React.FC = () => {
  const { token = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const query = useQuery({
    // By user too: whether it is their own depends on who is signed in.
    queryKey: ["shared-component", token, userId],
    queryFn: () => fetchSharedComponent(token),
    enabled: !isSessionPending,
    retry: false,
  });
  const component = query.data;
  const { signIn, isSigningIn: signingIn } = useTwitchSignIn(`${sharedComponentPath(token)}?add=1`);
  const addition = useMutation({
    mutationFn: () => addSharedComponent(token),
    onSuccess: (saved) =>
      queryClient.setQueryData<SavedComponent[]>(COMPONENTS_QUERY_KEY, (current) =>
        current ? [saved, ...current] : current
      ),
  });
  const added = addition.data;
  const { mutate: add } = addition;

  const autoAdd = searchParams.get("add") === "1";
  const autoAdded = useRef(false);
  useEffect(() => {
    if (!autoAdd || !component || !session || autoAdded.current) return;
    autoAdded.current = true;
    setSearchParams({}, { replace: true });
    if (!component.own) add();
  }, [autoAdd, component, session, setSearchParams, add]);


  if (isSessionPending || query.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (query.isError || !component) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Link2Off className="size-8" />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {query.error?.message ?? "This link doesn't work anymore"}
        </h1>
        <p className="text-muted-foreground">
          If its owner stopped sharing the component or deleted it, ask them for a new link.
        </p>
        <Button asChild variant="outline" className="mt-2">
          <Link to="/">Go to ovrly</Link>
        </Button>
      </div>
    );
  }

  const count = countComponentElements(component.elements);
  const dropped = added && droppedImagesMessage(added.droppedImages);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-16">
      <ComponentPreview
        component={{ id: token, elements: component.elements }}
        className="aspect-video w-full rounded-xl border shadow-sm"
      />

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-primary uppercase">
            <Blocks className="size-3.5" />
            Shared component
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight break-words sm:text-3xl">
            {component.name}
          </h1>
          {component.description && (
            <p className="whitespace-pre-line text-muted-foreground">{component.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Avatar member={component.owner} className="size-6" />
              Shared by <span className="font-medium text-foreground">{component.owner.name}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Layers className="size-4" />
              {count} {count === 1 ? "element" : "elements"}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          {!session ? (
            <Button
              size="lg"
              onClick={() => void signIn()}
              disabled={signingIn}
              className="bg-brand-twitch text-brand-twitch-foreground hover:bg-brand-twitch/90"
            >
              {signingIn ? <Loader2 className="animate-spin" /> : <TwitchIcon />}
              Sign in with Twitch to add it
            </Button>
          ) : component.own ? (
            <Button asChild size="lg" variant="outline">
              <Link to={MY_COMPONENTS}>Open my components</Link>
            </Button>
          ) : added ? (
            <Button asChild size="lg">
              <Link to={MY_COMPONENTS}>Open my components</Link>
            </Button>
          ) : (
            <Button size="lg" onClick={() => add()} disabled={addition.isPending}>
              {addition.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              Add to my components
            </Button>
          )}
        </div>
      </div>

      {addition.isError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" />
          {addition.error.message}
        </div>
      )}

      {(added || component.own) && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
        >
          {added ? (
            <Check className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0" />
          )}
          <p>
            {added ? (
              <>
                “{added.name}” is in your components now. Add it to any overlay from “Add element”
                → “My components”. {dropped}
              </>
            ) : (
              "This is one of your components. Others who open this link can add a copy of it."
            )}
          </p>
        </div>
      )}

      {!added && !component.own && (
        <p className="text-sm text-muted-foreground">
          Adding it gives you your own copy to use in any of your overlays. Values it shows from
          variables, like Twitch stats, come from your account.
        </p>
      )}
    </div>
  );
};

export default SharedComponentPage;
