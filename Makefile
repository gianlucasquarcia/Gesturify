UUID=gesturify@gianlucasquarcia.github.io
DEST=$(HOME)/.local/share/gnome-shell/extensions/$(UUID)

schemas/gschemas.compiled: schemas/*.gschema.xml
	glib-compile-schemas schemas

install: schemas/gschemas.compiled
	mkdir -p $(DEST)
	cp -r metadata.json extension.js prefs.js lib schemas LICENSE $(DEST)/

# Builds $(UUID).shell-extension.zip, ready for upload to extensions.gnome.org
pack:
	gnome-extensions pack --force --extra-source=lib --extra-source=LICENSE .

.PHONY: install pack
