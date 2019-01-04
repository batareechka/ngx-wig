import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation,
  forwardRef,
  Inject,
} from '@angular/core';

import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { NgxWigToolbarService, TButton } from './ngx-wig-toolbar.service';
import { DOCUMENT } from '@angular/common';

/** @dynamic */
@Component({
  selector: 'ngx-wig',
  templateUrl: './ngx-wig.html',
  styleUrls: ['./ngx-wig.css'],
  providers: [
    NgxWigToolbarService,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NgxWigComponent),
      multi: true
    }
  ],
  encapsulation: ViewEncapsulation.None
})
export class NgxWigComponent implements OnInit, OnChanges, ControlValueAccessor {

  @Input()
  public content: string;

  @Input()
  public placeholder: string;

  @Input()
  public buttons: string;

  @Input()
  public disabled: boolean;

  @Input()
  public isSourceModeAllowed = false;

  @Output()
  public contentChange = new EventEmitter();

  @ViewChild('ngWigEditable')
  public ngxWigEditable: ElementRef;

  public editMode = false;
  public container: HTMLElement;
  public toolbarButtons: TButton[] = [];
  public hasFocus = false;

  public constructor(
    private _ngWigToolbarService: NgxWigToolbarService,
    @Inject(DOCUMENT) private document: any, // cannot set Document here - Angular issue - https://github.com/angular/angular/issues/20351
    @Inject('WINDOW') private window,
  ) {}

  public toggleEditMode(): void {
    this.editMode = !this.editMode;
  }

  public execCommand(command: string, options?: string): boolean {
    if (this.editMode) {
      return false;
    }
    if (this.document.queryCommandSupported && !this.document.queryCommandSupported(command)) {
      throw 'The command "' + command + '" is not supported';
    }
    if (command === 'createlink' || command === 'insertImage') {
      options = window.prompt('Please enter the URL', 'http://') || '';
      if (!options) {
        return false;
      }
    }

    this.container.focus();

    // use insertHtml for `createlink` command to account for IE/Edge purposes, in case there is no selection
    let selection = this.document.getSelection().toString();
    if (command === 'createlink' && selection === '') {
      this.document.execCommand('insertHtml', false, '<a href="' + options + '">' + options + '</a>');
    } else {
      this.document.execCommand(command, false, options);
    }

    this.onContentChange(this.container.innerHTML);
    return true;
  }

  public ngOnInit(): void {
    this.toolbarButtons = this._ngWigToolbarService.getToolbarButtons(this.buttons);
    this.container = this.ngxWigEditable.nativeElement;

    if (this.content) {
      this.container.innerHTML = this.content;
    }
  }

  public onContentChange(newContent: string): void {
    this.content = newContent;
    this.contentChange.emit(this.content);
    this.propagateChange(this.content);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (this.container && changes['content']) {
      // clear the previous content
      this.container.innerHTML = '';

      // add the new content
      this.pasteHtmlAtCaret(changes['content'].currentValue);
    }
  }

  public onTextareaChange(newContent: string): void {
    // model -> view
    this.container.innerHTML = newContent;
    this.onContentChange(newContent);
  }

  public writeValue(value: any): void {
    if (!value) { value = ''; }

    this.container.innerHTML = value;
    this.onContentChange(value);
  }

  public shouldShowPlaceholder(): boolean {
    return !!this.placeholder
      && !this.container.innerText;
  }

  private pasteHtmlAtCaret(html) {
    let sel, range;

    if (window.getSelection) {
      sel = window.getSelection();

      if (sel.getRangeAt && sel.rangeCount) {
        range = sel.getRangeAt(0);
        range.deleteContents();

        // append the content in a temporary div
        let el = this.document.createElement('div');
        el.innerHTML = html;
        let frag = this.document.createDocumentFragment(), node, lastNode;
        while ( (node = el.firstChild) ) {
          lastNode = frag.appendChild(node);
        }
        range.insertNode(frag);

        // Preserve the selection
        if (lastNode) {
          range = range.cloneRange();
          range.setStartAfter(lastNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
  }

  public registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.propagateTouched = fn;
  }

  private propagateChange: any = (_: any) => { };
  public propagateTouched = () => {};

  onBlur() {
    this.hasFocus = false;
    this.propagateTouched();
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
