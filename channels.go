// App that keeps list of available files up to date
// It scans files in a directory, "builds" part of menu and replaces it in the menu.js file.
//
// Example usage:
//
//	go run channels.go channels scripts/menu.js
package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type Menu []Screen

type Screen struct {
	Key    string  `json:"key"`
	Header string  `json:"header"`
	Items  []*Item `json:"items"`
}

type Item struct {
	Label     string `json:"label"`
	Action    string `json:"action"`
	Target    string `json:"target,omitempty"`
	Video     string `json:"video,omitempty"`
	Audio     string `json:"audio,omitempty"`
	Subtitles string `json:"subtitles,omitempty"`
}

func getBaseName(filename string) string {
	// Remove extension
	base := strings.TrimSuffix(filename, filepath.Ext(filename))
	// Remove _audio suffix if present
	return strings.TrimSuffix(base, "_audio")
}

func formatHeader(header string) string {
	// header length is 24 characters
	// example header: --------- MENU ---------

	result := strings.Builder{}
	result.WriteString(strings.Repeat("-", (22-len(header))/2))
	result.WriteString(" ")
	result.WriteString(strings.ToUpper(header))
	result.WriteString(" ")
	result.WriteString(strings.Repeat("-", (22-len(header))/2))
	if len(header)%2 == 1 {
		result.WriteString("-")
	}
	return result.String()
}

func scanFiles(path string) (map[string]map[string]map[string]string, error) {
	// Map to store files by their base name
	// dir -> base name -> file type -> file path
	fileMap := make(map[string]map[string]map[string]string)

	err := filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return fmt.Errorf("error walking directory: %w", err)
		}

		if info.IsDir() {
			return nil
		}

		dir := filepath.Base(filepath.Dir(path))
		filename := filepath.Base(path)
		ext := strings.ToLower(filepath.Ext(filename))
		baseName := getBaseName(filename)

		// Initialize map for this base name if it doesn't exist
		if _, ok := fileMap[dir]; !ok {
			fileMap[dir] = make(map[string]map[string]string)
		}

		if _, ok := fileMap[dir][baseName]; !ok {
			fileMap[dir][baseName] = make(map[string]string)
		}

		// Store the file path based on its type
		switch ext {
		case ".mp4":
			if strings.HasSuffix(filename, "_audio.mp4") {
				fileMap[dir][baseName]["audio"] = filename
			} else {
				fileMap[dir][baseName]["video"] = filename
			}
		case ".vtt":
			fileMap[dir][baseName]["subtitles"] = filename
		}

		return nil
	})
	return fileMap, err
}

func main() {
	if len(os.Args) < 3 {
		log.Fatalf("Usage: %s <input directory> <output JS file>", os.Args[0])
	}
	in := os.Args[1]
	out := os.Args[2]

	fileMap, err := scanFiles(in)
	if err != nil {
		log.Fatalf("Error scanning files: %v", err)
	}

	// Build menu structure
	var m Menu

	s := Screen{
		Key:    "channels",
		Header: formatHeader("channels"),
		Items:  []*Item{},
	}
	for dir := range fileMap {
		s.Items = append(s.Items, &Item{
			Label:  strings.ToUpper(dir),
			Action: "navigate",
			Target: dir,
		})
	}
	s.Items = append(s.Items, &Item{
		Label:  "BACK",
		Action: "navigate",
		Target: "main",
	})
	m = append(m, s)

	for dir, dirContent := range fileMap {
		dirName := filepath.Base(dir)
		s = Screen{
			Key:    dirName,
			Header: formatHeader(dirName),
			Items:  []*Item{},
		}

		for baseName, files := range dirContent {
			// Only process if we have at least a video file
			if _, hasVideo := files["video"]; hasVideo {
				// Create item
				item := &Item{
					Label:  baseName,
					Action: "play",
					Video:  files["video"],
				}

				// Add audio if present
				if audioFile, hasAudio := files["audio"]; hasAudio {
					item.Audio = audioFile
				}

				// Add subtitles if present
				if subtitlesFile, hasSubtitles := files["subtitles"]; hasSubtitles {
					item.Subtitles = subtitlesFile
				}

				s.Items = append(s.Items, item)
			}
		}

		s.Items = append(s.Items, &Item{
			Label:  "BACK",
			Action: "navigate",
			Target: "channels", // todo: support multiple levels
		})

		m = append(m, s)
	}

	// write menu as JavaScript dictionary
	data := strings.Builder{}
	for _, s := range m {
		data.WriteString("  " + s.Key + ": {\n")
		data.WriteString("    header: '" + s.Header + "',\n")
		data.WriteString("    items: [\n")
		for _, i := range s.Items {
			data.WriteString("      {\n")
			data.WriteString("        label: '" + i.Label + "',\n")
			data.WriteString("        action: '" + i.Action + "',\n")
			if i.Target != "" {
				data.WriteString("        target: '" + i.Target + "',\n")
			}
			if i.Video != "" {
				data.WriteString("        video: '" + i.Video + "',\n")
			}
			if i.Audio != "" {
				data.WriteString("        audio: '" + i.Audio + "',\n")
			}
			if i.Subtitles != "" {
				data.WriteString("        subtitles: '" + i.Subtitles + "',\n")
			}
			data.WriteString("      },\n")
		}
		data.WriteString("    ],\n")
		data.WriteString("  },\n")
	}

	// Replace out content from // CHANNELS BEGIN to // CHANNELS END
	content, err := os.ReadFile(out)
	if err != nil {
		log.Fatalf("Error reading file %s: %v", out, err)
	}

	// Find the position of the channels begin and end
	begin := strings.Index(string(content), "// CHANNELS BEGIN")
	end := strings.Index(string(content), "// CHANNELS END")
	if begin == -1 || end == -1 {
		log.Fatalf("Could not find // CHANNELS BEGIN or // CHANNELS END in %s", out)
	}

	// Replace the content between begin and end
	// Add 17 to begin to skip the comment itself and the newline
	newContent := string(content[:begin+18]) + data.String() + "  " + string(content[end:])

	// Write the new content to the file
	if err := os.WriteFile(out, []byte(newContent), 0644); err != nil {
		log.Fatalf("Error writing to file %s: %v", out, err)
	}

	log.Printf("Updated %s with new menu", out)
}
