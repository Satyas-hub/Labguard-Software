package com.labguard.service;

import com.labguard.dto.HardwareDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class HardwareEventService {

    private final HardwareEventRepository hardwareEventRepository;
    private final ComputerRepository computerRepository;
    private final ComputerEquipmentRepository computerEquipmentRepository;
    private final SessionRepository sessionRepository;
    private final NotificationService notificationService;

    public List<HardwareEventDetailDto> getEventsByLab(UUID labId) {
        return hardwareEventRepository.findByLabIdOrderByEventTimeDesc(labId).stream()
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    public List<HardwareEventDetailDto> getRecentEvents() {
        return hardwareEventRepository.findRecentEvents(OffsetDateTime.now().minusDays(1)).stream()
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    /**
     * Records supported hardware events from the Windows Client.
     * Enforces strictly neutral wording: "Mouse connection lost." (Not damage allegation).
     */
    @Transactional
    public HardwareEventDetailDto recordHardwareEvent(ReportHardwareEventRequest request) {
        Computer computer = computerRepository.findByLabCodeAndPcCode(request.getLabCode(), request.getPcCode())
            .orElseThrow(() -> new ResourceNotFoundException("Workstation not found: " + request.getPcCode() + " in " + request.getLabCode()));

        Equipment equipment = null;
        if (request.getSlotType() != null) {
            Optional<ComputerEquipment> ceOpt = computerEquipmentRepository.findActiveByComputerIdAndSlotType(
                computer.getId(), request.getSlotType().toUpperCase()
            );
            if (ceOpt.isPresent()) {
                equipment = ceOpt.get().getEquipment();
            }
        }

        // Determine neutral wording
        String description = request.getDescription();
        String severity = "INFO";

        if ("HARDWARE_DISCONNECTED".equalsIgnoreCase(request.getEventType())) {
            severity = "WARNING";
            if ("MOUSE".equalsIgnoreCase(request.getSlotType())) {
                description = "Mouse connection lost.";
            } else if ("KEYBOARD".equalsIgnoreCase(request.getSlotType())) {
                description = "Keyboard connection lost.";
            } else {
                description = "Peripheral device disconnected.";
            }
        } else if ("HARDWARE_CONNECTED".equalsIgnoreCase(request.getEventType())) {
            severity = "INFO";
            if ("MOUSE".equalsIgnoreCase(request.getSlotType())) {
                description = "Mouse connected and verified.";
            } else if ("KEYBOARD".equalsIgnoreCase(request.getSlotType())) {
                description = "Keyboard connected and verified.";
            } else {
                description = "Peripheral device connected.";
            }
        } else if ("HARDWARE_MISMATCH".equalsIgnoreCase(request.getEventType())) {
            severity = "WARNING";
            description = "Unregistered peripheral detected on USB port.";
        }

        Optional<Session> activeSession = sessionRepository.findActiveSessionByComputerId(computer.getId());

        HardwareEvent event = HardwareEvent.builder()
            .lab(computer.getLab())
            .computer(computer)
            .equipment(equipment)
            .session(activeSession.orElse(null))
            .eventType(request.getEventType().toUpperCase())
            .severity(severity)
            .description(description)
            .eventTime(OffsetDateTime.now())
            .build();

        hardwareEventRepository.save(event);

        // Dispatch role- and lab-scoped notification with anti-flooding cooldown
        notificationService.dispatchHardwareAlert(
            computer.getLab(),
            computer,
            equipment,
            request.getEventType().toUpperCase(),
            severity,
            description,
            "Workstation " + computer.getPcCode() + " in " + computer.getLab().getCode() + ": " + description
        );

        return toDetailDto(event);
    }

    private HardwareEventDetailDto toDetailDto(HardwareEvent event) {
        String activeEmail = null;
        String activeRole = null;
        if (event.getSession() != null) {
            activeEmail = event.getSession().getUser().getEmail();
            activeRole = event.getSession().getRole();
        }

        return HardwareEventDetailDto.builder()
            .id(event.getId())
            .labId(event.getLab().getId())
            .labCode(event.getLab().getCode())
            .computerId(event.getComputer().getId())
            .pcCode(event.getComputer().getPcCode())
            .equipmentId(event.getEquipment() != null ? event.getEquipment().getId() : null)
            .equipmentAssetId(event.getEquipment() != null ? event.getEquipment().getAssetId() : "NONE")
            .equipmentType(event.getEquipment() != null ? event.getEquipment().getType() : "NONE")
            .eventType(event.getEventType())
            .severity(event.getSeverity())
            .description(event.getDescription())
            .eventTime(event.getEventTime())
            .activeUserEmail(activeEmail)
            .activeUserRole(activeRole)
            .build();
    }
}
