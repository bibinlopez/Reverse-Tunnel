import pkg from "ssh2"
const { Server } = pkg
import fs from "fs"
import { v4 as uuidv4 } from "uuid"

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

        await new Promise((r) => setTimeout(r, 1000)) // 1 second

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

        // client.on("session", (accept) => {
        //   const session = accept()
        //   // session.on("pty", (accept) => accept && accept())
        //   session.on("shell", (accept) => {
        //     const stream = accept()
        //     stream.write(
        //       `Hi.. ${client.username}, you requested domain already exits, please try with another...   `
        //     )
        //     // if (user) {
        //     //   stream.close()
        //     //   session.close
        //     // }
        //   })
        //   // session.close
        // })
        // Handle reverse tunnel request
        // handleReverseTunnel(client, accept, reject, info)
      } else {
        console.log("no tcp forward")
        await new Promise((r) => setTimeout(r, 1000)) // 1 second

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

sshServer.listen(22, "0.0.0.0", () => {
  console.log("SSH server listening on port 22")
})
