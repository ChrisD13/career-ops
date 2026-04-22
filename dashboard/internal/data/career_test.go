package data

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/santifer/career-ops/dashboard/internal/model"
)

func TestReplaceStatusInLineOnlyTouchesStatusColumn(t *testing.T) {
	line := "| 12 | 2026-04-10 | Acme | Applied Scientist | 4.6/5 | Applied | PDF ✅ | [012](reports/applied.md) | Applied via referral |"

	got := replaceStatusInLine(line, "Interview")
	want := "| 12 | 2026-04-10 | Acme | Applied Scientist | 4.6/5 | Interview | PDF ✅ | [012](reports/applied.md) | Applied via referral |"

	if got != want {
		t.Fatalf("unexpected rewritten line:\nwant: %s\ngot:  %s", want, got)
	}
}

func TestEnrichFromScanHistoryReadsDataDirectory(t *testing.T) {
	root := t.TempDir()
	dataDir := filepath.Join(root, "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatalf("mkdir data: %v", err)
	}

	scanHistory := "url\tfirst_seen\tportal\ttitle\tcompany\tstatus\n" +
		"https://jobs.example.com/acme-pm\t2026-04-10\tashby-api\tSenior Product Manager AI\tAcme\tadded\n"
	if err := os.WriteFile(filepath.Join(dataDir, "scan-history.tsv"), []byte(scanHistory), 0o644); err != nil {
		t.Fatalf("write scan history: %v", err)
	}

	apps := []model.CareerApplication{
		{Company: "Acme", Role: "Senior Product Manager"},
	}

	enrichFromScanHistory(root, apps)

	if apps[0].JobURL != "https://jobs.example.com/acme-pm" {
		t.Fatalf("expected JobURL to be filled from data/scan-history.tsv, got %q", apps[0].JobURL)
	}
}
