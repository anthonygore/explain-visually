# Example: Architecture

This examples shows how an architectural concept like the Web Request-Response loop can be visualized.

The Explanation section shows the input the system would likely receive. I generated this from an LLM after asking it to explain the concept.

The Outline section shows an interpretation of the explanation. This is human created.

The Scene Spec shows an interpreation of the Outline. This is human created.

## Explanation

The web request-response loop is the core process where a client (like a web browser) sends an HTTP Request to a server, and the server processes it and sends back an HTTP Response. 

This two-step exchange happens every time you load a page, click a link, or send a form.

Step 1: Client Request
- User Action: You type a web address or click a button.
- DNS Lookup: The browser finds the server's IP address.
- Message Build: The browser creates an HTTP request with a method like GET or POST, plus headers and data.

Step 2: Server Processing
- Receive: The server gets the request message.
- Logic & Data: The backend runs code and checks databases if needed.
- Build Response: The server packages the data, such as HTML or JSON, with a status code like 200 OK.

Step 3: Client Rendering
- Receive Response: The browser gets the data back from the server.
- Display: The browser reads the code and shows the final page or updates the screen.

## Outline

1. 

Text: 
The Request-Response Loop

2. 

Diagram:
On the left side is a browser. On the right side is a server.

Animation:
An animated messages travels between the browser and server.

Narration:
The web request-response loop is the process where a client, like a web browser, sends a request to a server, and the server processes it and sends back. This two-step exchange happens every time you load a page, click a link, or send a form.

3.

Narration:
Let's say you type a web address or click a button.

Image:
A web page.

4.

Narration:
The browser packages this action as an HTTP request with a method like GET or POST.

Diagram:
A card representing an HTTP request showing method, URL, etc.

5.

Narration:
The browser finds the server's IP address and send the request.

Diagram:
On the left side is a browser. On the right side is a server.

Animation:
An animated messages travels between the browser and server.

6.

Narration:
The server will now receive the request message and handle it. This might involve reading or writing a database.

Diagram:
A server linked to a database.

Animation:
First, highlight the server, then highlight the database.

7.

Narration:
Once the request has been handled, an HTTP response is created and packages up HTML or JSON, as well as a status that reflects whether or not the request was successful.

Diagram:
An HTTP request. Re-use the diagram from scene 4.

8.

Narration:
The response is then sent from the server back to the client.

Diagram:
A globe showing nodes representing the internet. Re-use the same diagram from scene 5.

Animation:
A message travels between two nodes. Re-use the same animatiom from scene 5.

9.

Narration:
The browser gets the data back from the server. The browser reads the code and shows the final page or updates the screen.

Diagram:
A web browser. Re-use the same one from step 3.

## Scene Spec

```yaml
entities:
  client:
    type: icon
    name: icon-park-twotone:laptop
  server:
    type: icon
    name: streamline-cyber-color:server
  webpage:
    type: icon
    name: icon-park:web-page
  database:
    type: icon
    name: vadivam:database

scenes:
  - id: scene_1
    layout:
      type: title
      content:
        title: "The Request-Response Loop"
  - id: scene_2
    layout:
      type: full_width
      content:
        element: message_flow
          content:
            items:
              - client
                server
            animated: true
    narration: "The web request-response loop is the process where a client, like a web browser, sends a request to a server, and the server processes it and sends back. This two-step exchange happens every time you load a page, click a link, or send a form."
  - id: scene_3
    layout:
      type: full_width
      content: 
        items:
          - webpage
    events:
      - type: highlight
        target: webpage
    narration: "Let's say you type a web address or click a button."
  - id: scene_4
    layout:
      type: full_width
      content:
        items:
          - card:
              title: "HTTP GET /signup"
    narration: "The browser packages this action as an HTTP request with a method like GET or POST."
  - id: scene_5
    layout:
      type: full_width
      content:
        element: message_flow
          content:
            items:
              - client
                server
            animated: true
    narration: "The browser finds the server's IP address and send the request."
  - id: scene_6
    layout:
      type: full_width
      content:
        element: message_flow
          content:
            items:
              - server
                database
            animated: true
    narration: "The server will now receive the request message and handle it. This might involve reading or writing a database."
  - id: scene_7
    layout:
      type: full_width
      content:
        items:
          - card:
              title: "HTTP GET /signup"
    narration: "Once the request has been handled, an HTTP response is created and packages up HTML or JSON, as well as a status that reflects whether or not the request was successful."
  - id: scene_8
    layout:
      type: full_width
      content:
        element: message_flow
          content:
            items:
              - server
                database
            animated: true
    narration: "The response is then sent from the server back to the client."
  - id: scene_9
    layout:
      type: full_width
      content: 
        items:
          - webpage
    events:
      - type: highlight
        target: webpage
    narration: "The browser gets the data back from the server. The browser reads the code and shows the final page or updates the screen."
```