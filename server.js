import dotenv from "dotenv"
dotenv.config()
import pkg from "ssh2"
const { Server } = pkg
import fs from "fs"
import { v4 as uuidv4 } from "uuid"
import net from "net"
import http from "http"

const httpPort =
  process.env.NODE_ENV === "production"
    ? process.env.PROD_HTTP_PORT
    : process.env.DEV_HTTP_PORT

const activeTunnels = {}

const sshServer = new Server({
  hostKeys: [fs.readFileSync("host.key")],
})

sshServer.on("connection", (client, info) => {
  console.log(`SSH Connected from ${info.ip}`)

  client.on("authentication", (ctx) => {
    client.username = ctx.username?.toLowerCase() || "user"
    client.sessionId = uuidv4()

    console.log("username", client.username, client.sessionId)
    ctx.accept()
  }) // No authentication

  client.on("ready", () => {
    console.log("Client authenticated!")

    console.log({ activeTunnels })

    let shellStream
    let sessionReady

    client.on("session", (accept) => {
      sessionReady = accept()
      sessionReady.on("pty", (accept) => accept && accept())
      sessionReady.on("shell", (accept) => {
        shellStream = accept()

        shellStream.on("data", (data) => {
          // CTRL + C = ASCII 3
          if (data[0] === 3) {
            shellStream.close()
            sessionReady.close
          }
        })
      })
    })

    client.on("request", async (accept, reject, name, info) => {
      if (name === "tcpip-forward") {
        console.log("yes tcp forward")

        await new Promise((r) => setTimeout(r, 100)) // 1 second

        const user = activeTunnels[client.username]

        if (user) {
          shellStream.write(
            `Hi.. ${client.username}, you requested domain already exits, please try with another...   `
          )
          shellStream.close()
          sessionReady.close
        }
        activeTunnels[client.username] = { sessionId: client.sessionId }
        shellStream.write(
          `Hi ${client.username}, Welcome to SSH Tunnel Server!  `
        )

        // Handle reverse tunnel request
        handleReverseTunnel(client, accept, reject, info, shellStream)
      } else {
        console.log("no tcp forward")
        await new Promise((r) => setTimeout(r, 100)) // 1 second

        shellStream.write(
          "Only Accepting Reverse tunnel requests. Try using the correct command..."
        )
        shellStream.close()
        sessionReady.close
        // reject()
      }
    })

    // if any error occurs..
    client.on("error", (err) => {
      console.error("Client error:", err)
    })

    // session disconnect
    client.on("end", () => {
      console.log(`❌ Disconnected: ${client.username} ${client.sessionId}`)

      const user = activeTunnels[client.username]
      if (user && user.sessionId === client.sessionId) {
        console.log("deleting the user from the tunnel")

        delete activeTunnels[client.username]
      }
    })
  })
})

const sshPort =
  process.env.NODE_ENV === "production"
    ? process.env.PROD_SSH_PORT
    : process.env.DEV_SSH_PORT

sshServer.listen(sshPort, "0.0.0.0", () => {
  console.log(`SSH server listening on port ${sshPort}`)
})

// Handle Reverse Tunnel function
async function handleReverseTunnel(client, accept, reject, info, shellStream) {
  console.log({ info })

  const bindAddr = info.bindAddr
  let bindPort = info.bindPort

  console.log("dest address", info.destAddr)
  console.log("dest port", info.destPort)

  const customPort = 4000

  const user = activeTunnels[client.username]
  activeTunnels[client.username] = { ...user, port: customPort }

  const tcpServer = net.createServer((socket) => {
    client.forwardOut(
      bindAddr || "0.0.0.0",
      bindPort,
      bindAddr || "localhost",
      info.destPort || bindPort,
      (err, stream) => {
        if (err) {
          console.error("Forward error:", err)
          socket.end()
          return
        }
        socket.pipe(stream).pipe(socket)
      }
    )
  })

  tcpServer.listen(customPort, info.bindAddr || "0.0.0.0", (err) => {
    console.log(
      `Reverse tunnel: ${customPort} -> client:${info.destPort || bindPort}`
    )
  })

  shellStream.write(
    `hi your server is listening on public , http://${client.username}.localhost:${httpPort}`
  )

  tcpServer.on("error", (err) => {
    console.log(err)
  })
}

// http server
const httpServer = http.createServer(async (req, res) => {
  const host = req.headers.host
  if (!host) return res.end("Missing Host header")
  console.log(host, "host")

  const subdomain = host.split(".")[0]
  console.log(subdomain, "sbudomain")
  // await new Promise((res) => setTimeout(res, 1000)) // waits 3 seconds
  console.log({ activeTunnels })

  const tunnel = activeTunnels[subdomain]

  // if (!tunnel) {
  //   res.statusCode = 502
  //   return res.end(`No active tunnel for ${subdomain}`)
  // }

  if (!tunnel) {
    res.end("Invalid url")
    return
  }

  // proxy.web(req, res, { target: `http://localhost:${tunnel.port}` }, (err) => {
  //   res.statusCode = 502
  //   res.end("Proxy error: " + err.message)
  // })
})

httpServer.listen(httpPort, () =>
  console.log(`🌍 HTTP proxy on port ${httpPort}`)
)
