extends CanvasLayer

@onready var panel: PanelContainer = $PanelContainer
@onready var sender_label: Label = $PanelContainer/MarginContainer/VBoxContainer/SenderLabel
@onready var text_label: Label = $PanelContainer/MarginContainer/VBoxContainer/TextLabel
@onready var dismiss_button: Button = $PanelContainer/MarginContainer/VBoxContainer/DismissButton

func _ready() -> void:
	panel.visible = false
	TransmissionSystem.show_transmission.connect(_on_show_transmission)
	if dismiss_button:
		dismiss_button.pressed.connect(_on_dismiss)

func _on_show_transmission(text: String, sender: String) -> void:
	if sender_label:
		sender_label.text = "[INTERCEPTED TRANSMISSION - %s]" % sender
	if text_label:
		text_label.text = text
	panel.visible = true

func _on_dismiss() -> void:
	panel.visible = false
	TransmissionSystem.close_transmission()
