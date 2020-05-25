import { Component, EventEmitter, Output } from '@angular/core';

@Component({
    template: ``
})
export abstract class BaseEditConfigurationComponent {
    @Output() save = new EventEmitter();
    @Output() modified = new EventEmitter();

    protected modify() {
        this.modified.emit();
    }
}