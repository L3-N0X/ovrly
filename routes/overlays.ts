import { prisma } from "../auth";
import { authenticate } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";

export const handleOverlaysRoutes = async (
  req: Request,
  server: { publish: (channel: string, message: string) => unknown | Promise<unknown> },
  path: string
) => {
  const overlayIdMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)$/);
  if (overlayIdMatch) {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const overlayId = overlayIdMatch[1];
    const overlay = await prisma.overlay.findUnique({
      where: { id: overlayId },
      include: {
        elements: {
          include: {
            title: true,
            counter: true,
            timer: true,
          },
        },
      },
    });

    if (!overlay) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isOwner = overlay.userId === session.user.id;
    const editors = await prisma.editor.findMany({ where: { userId: overlay.userId } });
    const isEditor = editors.some((editor) => editor.editorTwitchName === session.user.name);

    if (!isOwner && !isEditor) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      return new Response(JSON.stringify(overlay), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      try {
        const body = await req.json();
        console.log("[SERVER LOG] PATCH /api/overlays/:id body:", body);
        const { name, description, globalStyle } = body;
        const dataToUpdate: { name?: string; description?: string; globalStyle?: object } = {};

        if (name) {
          dataToUpdate.name = name;
        }
        if (description) {
          dataToUpdate.description = description;
        }
        if (globalStyle) {
          dataToUpdate.globalStyle = globalStyle;
        }

        if (Object.keys(dataToUpdate).length === 0) {
          return new Response(JSON.stringify({ error: "No valid fields to update" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updatedOverlay = await prisma.overlay.update({
          where: { id: overlayId },
          data: dataToUpdate,
          include: {
            elements: {
              include: {
                title: true,
                counter: true,
                timer: true,
              },
            },
          },
        });

        server.publish(`overlay-${overlayId}`, JSON.stringify(updatedOverlay));

        return new Response(JSON.stringify(updatedOverlay), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("PATCH /api/overlays/:id Error:", e);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (req.method === "DELETE") {
      if (!isOwner) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await prisma.overlay.delete({ where: { id: overlayId } });
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle GET /api/overlays (list all user overlays)
  if (path === "/api/overlays") {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const userOverlays = await prisma.overlay.findMany({
        where: { userId: session.user.id },
        include: {
          elements: {
            include: {
              title: true,
              counter: true,
              timer: true,
            },
          },
        },
      });

      const editors = await prisma.editor.findMany({
        where: { editorTwitchName: session.user.name },
      });

      const sharedOverlays = await prisma.overlay.findMany({
        where: {
          userId: {
            in: editors.map((v) => v.userId),
          },
        },
        include: {
          elements: {
            include: {
              title: true,
              counter: true,
              timer: true,
            },
          },
        },
      });

      return new Response(JSON.stringify([...userOverlays, ...sharedOverlays]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      try {
        const { name, description, type, elementName, presetId } = await req.json();

        // If presetId is provided, create overlay based on preset
        if (presetId) {
          // Load the preset
          const presetsPath = `${process.cwd()}/public/presets/overlay-presets.json`;
          const presetsContent = await Bun.file(presetsPath).text();
          const presets = JSON.parse(presetsContent);

          const selectedPreset = presets.presets.find((p: { id: string }) => p.id === presetId);
          if (!selectedPreset) {
            return new Response(JSON.stringify({ error: "Invalid preset ID" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Create the overlay with elements from the preset
          const newOverlay = await prisma.overlay.create({
            data: {
              name,
              description,
              userId: session.user.id,
              globalStyle: selectedPreset.globalStyle || {},
              elements: {
                create: selectedPreset.elements.map(
                  (element: {
                    name: string;
                    type: "TITLE" | "COUNTER" | "CONTAINER";
                    style?: object;
                    title?: { text: string };
                    counter?: { value: number };
                  }) => {
                    const elementCreateData: {
                      name: string;
                      type: "TITLE" | "COUNTER" | "CONTAINER";
                      style: object;
                      title?: { create: { text: string } };
                      counter?: { create: { value: number } };
                    } = {
                      name: element.name,
                      type: element.type,
                      style: element.style || {},
                    };

                    if (element.type === "TITLE") {
                      elementCreateData.title = {
                        create: { text: element.title?.text || "New Title" },
                      };
                    } else if (element.type === "COUNTER") {
                      elementCreateData.counter = {
                        create: { value: element.counter?.value || 0 },
                      };
                    }

                    return elementCreateData;
                  }
                ),
              },
            },
            include: {
              elements: {
                include: {
                  title: true,
                  counter: true,
                  timer: true,
                },
              },
            },
          });

          return new Response(JSON.stringify(newOverlay), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Otherwise, use the legacy method with a single element
        else if (name && type && elementName) {
          const elementCreateData: {
            name: string;
            type: "TITLE" | "COUNTER" | "CONTAINER";
            style: object;
            title?: { create: { text: string } };
            counter?: { create: { value: number } };
          } = {
            name: elementName,
            type: type as "TITLE" | "COUNTER" | "CONTAINER",
            style: {}, // Initialize with empty style object instead of null
          };

          if (type === "TITLE") {
            elementCreateData.title = { create: { text: "New Title" } };
          } else if (type === "COUNTER") {
            elementCreateData.counter = { create: { value: 0 } };
          } else {
            return new Response(JSON.stringify({ error: "Invalid element type" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const newOverlay = await prisma.overlay.create({
            data: {
              name,
              description,
              userId: session.user.id,
              globalStyle: {},
              elements: {
                create: [elementCreateData],
              },
            },
            include: {
              elements: {
                include: {
                  title: true,
                  counter: true,
                  timer: true,
                },
              },
            },
          });

          return new Response(JSON.stringify(newOverlay), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          return new Response(
            JSON.stringify({
              error: "Either presetId or name, type, and elementName are required",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null; // Return null if route doesn't match
};
