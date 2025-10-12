import dotenv from "dotenv";
import { auth, prisma } from "./auth";

dotenv.config();

interface WebSocketData {
  overlayId: string;
}

const server = Bun.serve({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;

    console.log(`\n[SERVER LOG] =========== New Request ===========`);
    console.log(`[SERVER LOG] Path & Method: ${req.method} ${path}`);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "http://localhost:5173",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (path.startsWith("/api/auth/")) {
      console.log(`[SERVER LOG] Twitch Client ID: ${process.env.AUTH_TWITCH_ID}`);
      console.log(
        `[SERVER LOG] Twitch Client Secret: ${
          process.env.AUTH_TWITCH_SECRET ? "********" : "Not Set"
        }`
      );
      const response = await auth.handler(req);
      for (const key in corsHeaders) {
        response.headers.set(key, corsHeaders[key as keyof typeof corsHeaders]);
      }
      return response;
    }

    const overlayIdMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)$/);
    if (overlayIdMatch) {
      const session = await auth.api.getSession({ headers: req.headers });
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

    const addElementMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)\/elements$/);
    if (addElementMatch && req.method === "POST") {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const overlayId = addElementMatch[1];
      const overlay = await prisma.overlay.findUnique({ where: { id: overlayId } });

      if (!overlay || overlay.userId !== session.user.id) {
        return new Response(JSON.stringify({ error: "Overlay not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const { name, type } = await req.json();
        if (!name || !type) {
          return new Response(JSON.stringify({ error: "Name and type are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const elementCreateData: any = {
          name: name,
          type: type,
          overlayId: overlayId,
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

        const newElement = await prisma.element.create({
          data: elementCreateData,
          include: { title: true, counter: true },
        });

        const updatedOverlay = await prisma.overlay.findUnique({
          where: { id: overlayId },
          include: {
            elements: {
              include: {
                title: true,
                counter: true,
              },
            },
          },
        });
        server.publish(`overlay-${overlayId}`, JSON.stringify(updatedOverlay));

        return new Response(JSON.stringify(newElement), {
          status: 201,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const elementIdMatch = path.match(/^\/api\/elements\/([a-zA-Z0-9_-]+)$/);
    if (elementIdMatch) {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const elementId = elementIdMatch[1];
      const element = await prisma.element.findUnique({
        where: { id: elementId },
        include: { overlay: true },
      });

      if (!element) {
        return new Response(JSON.stringify({ error: "Element not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isOwner = element.overlay.userId === session.user.id;
      const editors = await prisma.editor.findMany({ where: { userId: element.overlay.userId } });
      const isEditor = editors.some((editor) => editor.editorTwitchName === session.user.name);

      if (!isOwner && !isEditor) {
        return new Response(JSON.stringify({ error: "Element not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "PATCH") {
        try {
          const { name, style, data } = await req.json();
          const elementUpdateData: any = {};
          if (name) elementUpdateData.name = name;
          if (style) elementUpdateData.style = style;

          if (data) {
            if (element.type === "TITLE" && typeof data.text === "string") {
              elementUpdateData.title = { update: { text: data.text } };
            }
            if (element.type === "COUNTER" && typeof data.value === "number") {
              elementUpdateData.counter = { update: { value: data.value } };
            }
          }

          const updatedElement = await prisma.element.update({
            where: { id: elementId },
            data: elementUpdateData,
            include: { title: true, counter: true },
          });

          const updatedOverlay = await prisma.overlay.findUnique({
            where: { id: element.overlayId },
            include: {
              elements: {
                include: {
                  title: true,
                  counter: true,
                },
              },
            },
          });
          server.publish(`overlay-${element.overlayId}`, JSON.stringify(updatedOverlay));

          return new Response(JSON.stringify(updatedElement), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error(e);
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
        const deletedElement = await prisma.element.delete({ where: { id: elementId } });

        const updatedOverlay = await prisma.overlay.findUnique({
          where: { id: element.overlayId },
          include: {
            elements: {
              include: {
                title: true,
                counter: true,
              },
            },
          },
        });
        server.publish(`overlay-${element.overlayId}`, JSON.stringify(updatedOverlay));

        return new Response(null, { status: 204, headers: corsHeaders });
      }
    }

    const publicOverlayIdMatch = path.match(/^\/api\/public\/overlays\/([a-zA-Z0-9_-]+)$/);
    if (publicOverlayIdMatch) {
      const overlayId = publicOverlayIdMatch[1];
      const overlay = await prisma.overlay.findUnique({
        where: { id: overlayId },
        include: {
          elements: {
            include: {
              title: true,
              counter: true,
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

      if (req.method === "GET") {
        return new Response(JSON.stringify(overlay), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/api/overlays") {
      const session = await auth.api.getSession({ headers: req.headers });
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
                      type: "TITLE" | "COUNTER" | "GROUP";
                      style?: object;
                      title?: { text: string };
                      counter?: { value: number };
                    }) => {
                      const elementCreateData: {
                        name: string;
                        type: "TITLE" | "COUNTER" | "GROUP";
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
              type: "TITLE" | "COUNTER" | "GROUP";
              style: object;
              title?: { create: { text: string } };
              counter?: { create: { value: number } };
            } = {
              name: elementName,
              type: type as "TITLE" | "COUNTER" | "GROUP",
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

    if (path === "/api/editors") {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "GET") {
        const editors = await prisma.editor.findMany({ where: { userId: session.user.id } });
        return new Response(JSON.stringify(editors), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (req.method === "POST") {
        try {
          const { twitchName } = await req.json();
          if (!twitchName) {
            return new Response(JSON.stringify({ error: "Twitch name is required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const newEditor = await prisma.editor.create({
            data: { userId: session.user.id, editorTwitchName: twitchName },
          });
          return new Response(JSON.stringify(newEditor), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ error: "Invalid request body" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (req.method === "DELETE") {
        try {
          const { twitchName } = await req.json();
          if (!twitchName) {
            return new Response(JSON.stringify({ error: "Twitch name is required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await prisma.editor.delete({
            where: {
              userId_editorTwitchName: { userId: session.user.id, editorTwitchName: twitchName },
            },
          });
          return new Response(null, { status: 204, headers: corsHeaders });
        } catch {
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

    if (path === "/api/presets/overlays") {
      if (req.method === "GET") {
        try {
          // Read the presets file
          const presetsPath = `${process.cwd()}/public/presets/overlay-presets.json`;
          const presetsContent = await Bun.file(presetsPath).text();
          const presets = JSON.parse(presetsContent);

          return new Response(JSON.stringify(presets), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error reading presets:", error);
          return new Response(JSON.stringify({ error: "Failed to load presets" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "/ws") {
      const url = new URL(req.url);
      const overlayId = url.searchParams.get("overlayId");
      if (overlayId) {
        const upgraded = server.upgrade(req, {
          data: { overlayId },
        });
        if (upgraded) {
          console.log(`[SERVER LOG] WebSocket connection upgraded for overlay ${overlayId}`);
          return;
        }
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    console.log(`[SERVER LOG] No route matched. Responding with "Hello world!".`);
    return new Response("Hello world!");
  },
  websocket: {
    open(ws) {
      const { overlayId } = ws.data as WebSocketData;
      ws.subscribe(`overlay-${overlayId}`);
      console.log(`[SERVER LOG] WebSocket subscribed to overlay-${overlayId}`);
    },
    message() {
      // Not used in this implementation, but good to have for future features
    },
    close(ws) {
      const { overlayId } = ws.data as WebSocketData;
      console.log(`[SERVER LOG] WebSocket connection closed for overlay ${overlayId}`);
    },
  },
});
