UUID=gesturify@local
DEST=$(HOME)/.local/share/gnome-shell/extensions/$(UUID)

schemas/gschemas.compiled: schemas/*.gschema.xml
	glib-compile-schemas schemas

install: schemas/gschemas.compiled
	mkdir -p $(DEST)
	cp -r metadata.json extension.js prefs.js lib schemas $(DEST)/

pack:
	gnome-extensions pack --force --extra-source=lib .

.PHONY: install pack
