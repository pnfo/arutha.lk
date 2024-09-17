package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/fatih/color"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"github.com/skratchdot/open-golang/open"
	//_ "modernc.org/sqlite"
)

type QueryPayload struct {
	DBName string `json:"dbname"`
	Query  string `json:"query"`
}

var (
	dbConnections = make(map[string]*sqlx.DB)
	mutex         sync.Mutex
	APPNAME       = "Arutha.lk v2.0"
	rootPath      = "" // call such as ./server -root-path=../../ relative to the exePath
	exePath       = "" // determined programmetically below
	PORT          = ":8800"
	URL           = "http://localhost" + PORT
)

func getPathToFile(file string) string {
	return filepath.Join(exePath, rootPath, file)
}

func main() {
	printBox()

	noOpen := flag.Bool("no-open", false, "Prevent opening the URL in the browser")
	flag.StringVar(&rootPath, "root-path", "", "Where dist and dbs are located relative to the binary location.")
	flag.Parse() // Parse the command-line flags
	exeFile, _ := os.Executable()
	exePath = filepath.Dir(exeFile)
	color.White("Flags no-open=%t, root-path=%s, exePath: %s", *noOpen, rootPath, exePath)

	app := fiber.New(fiber.Config{AppName: APPNAME, DisableStartupMessage: true})

	// Use gzip compression middleware
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed, // Adjust compression level as needed
	}))

	// Define the endpoint for sqlite queries
	app.Post("/sql-query", func(c *fiber.Ctx) error {
		//return executeQueryAndReturnJSON(c)
		var payload QueryPayload
		if err := c.BodyParser(&payload); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}

		// Get or create database connection
		mutex.Lock()
		db, exists := dbConnections[payload.DBName]
		if !exists {
			var err error
			db, err = sqlx.Open("sqlite3", getPathToFile("server-data/"+payload.DBName)+"?mode=ro") // make sure to open read-only
			if err != nil {
				mutex.Unlock()
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}
			dbConnections[payload.DBName] = db
		}
		mutex.Unlock()

		// Execute the SQL query
		rows, err := db.Queryx(payload.Query)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
		}
		defer rows.Close()

		// Scan results into a slice of maps
		var results []map[string]interface{}
		for rows.Next() {
			result := make(map[string]interface{})
			err = rows.MapScan(result)
			if err != nil {
				return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
			}
			results = append(results, result)
		}

		// Return the results as JSON
		return c.JSON(results)
	})

	// Load metadata
	metadata, err := loadMetadata()
	if err != nil {
		log.Fatal(err)
	}
	app.Use(metadataMiddleware(&metadata)) // Apply middleware to handle metadata (title/desc) injection

	// Serve static files from dist folder
	app.Static("/", getPathToFile("dist"))
	// Define the "not found" handler to serve index.html - handles routes such as http://localhost:8400/dict/janaka
	app.Static("*", getPathToFile("dist/index.html")) // not found handler

	if !*noOpen {
		//color.Green("If your browser does not open automatically visit the following URL in your browser.")
		//color.Yellow("URL: %s", URL)
		if err := open.Start(URL); err != nil {
			color.Red("Failed to open URL(%s) %s", URL, err)
		}
	} else {
		color.White("URL (%s) not opened due to -no-open flag.", URL)
	}

	// Run the server
	log.Fatal(app.Listen(PORT))
}

func printBox() {
	gray := color.New(color.FgHiBlack)
	lines := []struct {
		Text  string
		Color *color.Color // Store the Color object directly
	}{
		{APPNAME, color.New(color.FgCyan, color.Bold)},
		{"┈┈┈┈┈┈┈┈┈┈┈┈", gray},
		{URL, color.New(color.FgYellow)},
		{"Visit the above URL in your browser to see the App.", color.New(color.FgHiGreen)},
		{"┄┄┄┄┄┄┄┄┄┈┈┈", gray},
		{"Suggestions and Errors - path.nirvana@gmail.com", gray},
		{"┄┄┄┄┄┄┄┄┄┈┈┈", gray},
		{"You can check if there is a newer version at", gray},
		{"https://github.com/pathnirvana/arutha.lk/releases", gray},
	}
	width := 60
	boxColor := gray

	// Print top border
	boxColor.Println("┏" + strings.Repeat("━", width) + "┓")

	for i := 0; i < len(lines); i++ {
		textLen := utf8.RuneCountInString(lines[i].Text)
		padding := (width - textLen) / 2 // Calculate padding for centering
		boxColor.Print("┃")
		fmt.Print(strings.Repeat(" ", padding))
		lines[i].Color.Print(lines[i].Text)
		fmt.Print(strings.Repeat(" ", width-padding-textLen))
		boxColor.Println("┃")
	}

	// Print bottom border
	boxColor.Println("┗" + strings.Repeat("━", width) + "┛")
}

type PageMetadata struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

func loadMetadata() (map[string]PageMetadata, error) {
	data, err := os.ReadFile(getPathToFile("server-data/metadata.json"))
	if err != nil {
		return nil, err
	}

	var metadata map[string]PageMetadata
	if err = json.Unmarshal(data, &metadata); err != nil {
		return nil, err
	}
	return metadata, nil
}

func metadataMiddleware(metadata *map[string]PageMetadata) fiber.Handler {
	return func(c *fiber.Ctx) error {
		parts := strings.Split(c.Path(), "/")
		pageMetadata, exists := (*metadata)["/"+parts[1]]
		if !exists {
			return c.Next()
		}

		if len(parts) > 2 && strings.Contains(pageMetadata.Title, "%s") {
			pageMetadata.Title = fmt.Sprintf(pageMetadata.Title, parts[2])
			pageMetadata.Description = fmt.Sprintf(pageMetadata.Description, parts[2])
		}

		// Replace placeholders in your index.html template
		html, err := os.ReadFile(getPathToFile("dist/index.html"))
		if err != nil {
			return err
		}

		htmlStr := string(html)
		htmlStr = strings.ReplaceAll(htmlStr, "{{title}}", pageMetadata.Title)
		htmlStr = strings.ReplaceAll(htmlStr, "{{description}}", pageMetadata.Description)

		c.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
		return c.SendString(htmlStr)
	}
}
