"""Todo list platform for Quest RPG.

Each player (config entry) gets three independent todo lists:
- quests       -> RPG-flavoured quests (added by the AI, or manually);
                  gold reward is encoded in the text as "(₡N)", the deadline
                  (if any) uses the todo item's native `due` field.
- shop_items   -> reward shop stock, price + stock encoded in the summary
- vouchers     -> purchased-but-not-yet-redeemed rewards

Items are persisted across restarts using RestoreEntity's extra stored data,
so nothing needs a separate database or YAML file.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from homeassistant.components.todo import (
    TodoItem,
    TodoItemStatus,
    TodoListEntity,
    TodoListEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import ExtraStoredData, RestoreEntity

from .const import (
    CONF_PLAYER_NAME,
    DOMAIN,
    SUFFIX_QUESTS,
    SUFFIX_SHOP_ITEMS,
    SUFFIX_VOUCHERS,
)

SUPPORTED_FEATURES = (
    TodoListEntityFeature.CREATE_TODO_ITEM
    | TodoListEntityFeature.UPDATE_TODO_ITEM
    | TodoListEntityFeature.DELETE_TODO_ITEM
)


@dataclass
class _TodoExtraStoredData(ExtraStoredData):
    """What gets written to storage/restored on restart."""

    items: list[dict[str, Any]]

    def as_dict(self) -> dict[str, Any]:
        return {"items": self.items}

    @classmethod
    def from_dict(cls, restored: dict[str, Any]) -> "_TodoExtraStoredData":
        return cls(items=restored.get("items", []))


class QuestRpgTodoListEntity(TodoListEntity, RestoreEntity):
    """Generic persisted todo list used for every Quest RPG list."""

    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_supported_features = SUPPORTED_FEATURES

    def __init__(
        self, entry: ConfigEntry, suffix: str, name: str, icon: str
    ) -> None:
        self._entry = entry
        self._suffix = suffix
        self._attr_unique_id = f"{entry.entry_id}_{suffix}"
        self._attr_name = name
        self._attr_icon = icon
        self._attr_todo_items = []

    @property
    def device_info(self):
        player_name = self._entry.data[CONF_PLAYER_NAME]
        return {
            "identifiers": {(DOMAIN, self._entry.entry_id)},
            "name": f"Quest RPG - {player_name}",
            "manufacturer": "Xornop",
            "model": "Quest RPG",
        }

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        last_data = await self.async_get_last_extra_data()
        if last_data is not None:
            restored = _TodoExtraStoredData.from_dict(last_data.as_dict())
            self._attr_todo_items = [
                TodoItem(
                    summary=i.get("summary"),
                    uid=i.get("uid"),
                    status=TodoItemStatus(i.get("status", TodoItemStatus.NEEDS_ACTION)),
                    due=datetime.fromisoformat(i["due"]) if i.get("due") else None,
                    description=i.get("description"),
                )
                for i in restored.items
            ]

    @property
    def extra_restore_state_data(self) -> ExtraStoredData:
        return _TodoExtraStoredData(
            items=[
                {
                    "summary": item.summary,
                    "uid": item.uid,
                    "status": item.status,
                    "description": item.description,
                    "due": item.due.isoformat() if item.due else None,
                }
                for item in (self._attr_todo_items or [])
            ]
        )

    def _persist(self) -> None:
        self.async_write_ha_state()
        self.hass.bus.async_fire(
            f"{DOMAIN}_todo_updated",
            {"entry_id": self._entry.entry_id, "suffix": self._suffix},
        )

    # -- TodoListEntity API -------------------------------------------------

    async def async_create_todo_item(self, item: TodoItem) -> None:
        item.uid = item.uid or uuid.uuid4().hex
        if item.status is None:
            item.status = TodoItemStatus.NEEDS_ACTION
        self._attr_todo_items = [*(self._attr_todo_items or []), item]
        self._persist()

    async def async_update_todo_item(self, item: TodoItem) -> None:
        items = list(self._attr_todo_items or [])
        for idx, existing in enumerate(items):
            if existing.uid == item.uid:
                items[idx] = TodoItem(
                    summary=item.summary
                    if item.summary is not None
                    else existing.summary,
                    uid=existing.uid,
                    status=item.status
                    if item.status is not None
                    else existing.status,
                    description=item.description
                    if item.description is not None
                    else existing.description,
                    due=item.due if item.due is not None else existing.due,
                )
                break
        self._attr_todo_items = items
        self._persist()

    async def async_delete_todo_items(self, uids: list[str]) -> None:
        self._attr_todo_items = [
            i for i in (self._attr_todo_items or []) if i.uid not in uids
        ]
        self._persist()

    # -- Convenience helpers used internally by services/sensors -----------

    def add_text_item(self, text: str, due: Any = None) -> TodoItem:
        item = TodoItem(
            summary=text,
            uid=uuid.uuid4().hex,
            status=TodoItemStatus.NEEDS_ACTION,
            due=due,
        )
        self._attr_todo_items = [*(self._attr_todo_items or []), item]
        self._persist()
        return item

    def remove_text_item(self, text: str) -> None:
        items = list(self._attr_todo_items or [])
        for idx, existing in enumerate(items):
            if existing.summary == text:
                del items[idx]
                break
        self._attr_todo_items = items
        self._persist()

    def rename_text_item(self, old_text: str, new_text: str) -> None:
        items = list(self._attr_todo_items or [])
        for idx, existing in enumerate(items):
            if existing.summary == old_text:
                items[idx] = TodoItem(
                    summary=new_text,
                    uid=existing.uid,
                    status=existing.status,
                    description=existing.description,
                    due=existing.due,
                )
                break
        self._attr_todo_items = items
        self._persist()

    @property
    def texts(self) -> list[str]:
        return [i.summary for i in (self._attr_todo_items or []) if i.summary]

    @property
    def items(self) -> list[TodoItem]:
        """Raw todo items, e.g. to read native due dates."""
        return list(self._attr_todo_items or [])


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    entities = [
        QuestRpgTodoListEntity(entry, SUFFIX_QUESTS, "Quests", "mdi:sword-cross"),
        QuestRpgTodoListEntity(entry, SUFFIX_SHOP_ITEMS, "Shop items", "mdi:store"),
        QuestRpgTodoListEntity(
            entry, SUFFIX_VOUCHERS, "Vouchers", "mdi:ticket-confirmation"
        ),
    ]
    hass.data[DOMAIN][entry.entry_id]["todo_entities"] = {
        SUFFIX_QUESTS: entities[0],
        SUFFIX_SHOP_ITEMS: entities[1],
        SUFFIX_VOUCHERS: entities[2],
    }
    async_add_entities(entities)
