package com.labguard.service;

import com.labguard.dto.ComputerDtos.*;
import com.labguard.entity.*;
import com.labguard.exception.ResourceNotFoundException;
import com.labguard.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
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
public class ComputerService {

    private final ComputerRepository computerRepository;
    private final LabRepository labRepository;
    private final ComputerEquipmentRepository computerEquipmentRepository;
    private final SessionRepository sessionRepository;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    @Value("${labguard.client.device-registration-secret:labguard-provision-device-sec-99}")
    private String expectedRegistrationSecret;

    public List<ComputerDetailDto> getComputersByLab(UUID labId) {
        return computerRepository.findByLabId(labId).stream()
            .map(this::toDetailDto)
            .collect(Collectors.toList());
    }

    public List<ComputerDetailDto> getComputersByLabCode(String labCode) {
        Lab lab = labRepository.findByCode(labCode)
            .orElseThrow(() -> new ResourceNotFoundException("Lab not found: " + labCode));
        return getComputersByLab(lab.getId());
    }

    public ComputerDetailDto getComputerDetail(UUID computerId) {
        Computer computer = computerRepository.findById(computerId)
            .orElseThrow(() -> new ResourceNotFoundException("Computer not found: " + computerId));
        return toDetailDto(computer);
    }

    @Transactional
    public ComputerDetailDto registerPc(RegisterPcRequest request) {
        if (!expectedRegistrationSecret.equals(request.getRegistrationSecret())) {
            throw new IllegalArgumentException("Invalid client registration secret. Workstation registration denied.");
        }

        Lab lab = labRepository.findByCode(request.getLabCode())
            .orElseThrow(() -> new ResourceNotFoundException("Lab not found: " + request.getLabCode()));

        Optional<Computer> existingOpt = computerRepository.findByLabIdAndPcCode(lab.getId(), request.getPcCode());
        Computer computer;
        if (existingOpt.isPresent()) {
            computer = existingOpt.get();
            computer.setHostname(request.getHostname());
            computer.setIpAddress(request.getIpAddress());
            computer.setMacAddress(request.getMacAddress());
            computer.setClientVersion(request.getClientVersion());
            computer.setIsOnline(true);
            computer.setLastHeartbeat(OffsetDateTime.now());
        } else {
            computer = Computer.builder()
                .lab(lab)
                .pcCode(request.getPcCode())
                .hostname(request.getHostname())
                .ipAddress(request.getIpAddress())
                .macAddress(request.getMacAddress())
                .clientVersion(request.getClientVersion())
                .status("AVAILABLE")
                .isOnline(true)
                .lastHeartbeat(OffsetDateTime.now())
                .build();
            lab.setPcCount(lab.getPcCount() + 1);
            labRepository.save(lab);
        }
        computerRepository.save(computer);

        auditLogService.logAction(null, "PC_REGISTERED", "Computer", computer.getId().toString(),
            lab.getId(), "Workstation " + computer.getPcCode() + " registered in " + lab.getCode());

        return toDetailDto(computer);
    }

    @Transactional
    public HeartbeatResponse processHeartbeat(HeartbeatRequest request) {
        Optional<Computer> pcOpt = computerRepository.findByLabCodeAndPcCode(request.getLabCode(), request.getPcCode());
        if (pcOpt.isEmpty()) {
            return HeartbeatResponse.builder()
                .acknowledged(false)
                .requiresLock(true)
                .message("PC not registered on server.")
                .build();
        }

        Computer computer = pcOpt.get();
        boolean wasOffline = !computer.getIsOnline();
        computer.setIsOnline(true);
        computer.setLastHeartbeat(OffsetDateTime.now());
        computer.setClientVersion(request.getClientVersion());
        computerRepository.save(computer);

        if (wasOffline) {
            notificationService.broadcastSystemNotification(
                computer.getLab(), computer, "PC_ONLINE", "INFO",
                computer.getPcCode() + " is back online",
                "Workstation " + computer.getPcCode() + " in " + computer.getLab().getCode() + " re-established connection."
            );
        }

        boolean requiresLock = "MAINTENANCE".equalsIgnoreCase(computer.getStatus());

        return HeartbeatResponse.builder()
            .acknowledged(true)
            .pcStatus(computer.getStatus())
            .requiresLock(requiresLock)
            .message("Heartbeat acknowledged.")
            .build();
    }

    @Scheduled(fixedRate = 60000) // Check every 60 seconds
    @Transactional
    public void detectOfflineComputers() {
        OffsetDateTime timeoutThreshold = OffsetDateTime.now().minusMinutes(2);
        List<Computer> onlinePcs = computerRepository.findAll().stream()
            .filter(Computer::getIsOnline)
            .collect(Collectors.toList());

        for (Computer computer : onlinePcs) {
            if (computer.getLastHeartbeat() != null && computer.getLastHeartbeat().isBefore(timeoutThreshold)) {
                computer.setIsOnline(false);
                if ("AVAILABLE".equalsIgnoreCase(computer.getStatus())) {
                    computer.setStatus("OFFLINE");
                }
                computerRepository.save(computer);

                log.warn("Computer {} in {} timed out. Marked OFFLINE.", computer.getPcCode(), computer.getLab().getCode());

                notificationService.broadcastSystemNotification(
                    computer.getLab(), computer, "PC_OFFLINE", "CRITICAL",
                    computer.getPcCode() + " is offline",
                    "Workstation " + computer.getPcCode() + " in " + computer.getLab().getCode() + " stopped transmitting heartbeat."
                );
            }
        }
    }

    public ComputerDetailDto toDetailDto(Computer computer) {
        String kbAssetId = "NONE";
        String kbStatus = "NOT_ASSIGNED";
        String msAssetId = "NONE";
        String msStatus = "NOT_ASSIGNED";

        Optional<ComputerEquipment> kbOpt = computerEquipmentRepository.findActiveByComputerIdAndSlotType(computer.getId(), "KEYBOARD");
        if (kbOpt.isPresent()) {
            kbAssetId = kbOpt.get().getEquipment().getAssetId();
            kbStatus = kbOpt.get().getEquipment().getStatus();
        }

        Optional<ComputerEquipment> msOpt = computerEquipmentRepository.findActiveByComputerIdAndSlotType(computer.getId(), "MOUSE");
        if (msOpt.isPresent()) {
            msAssetId = msOpt.get().getEquipment().getAssetId();
            msStatus = msOpt.get().getEquipment().getStatus();
        }

        String userFullName = null;
        String userRole = null;
        OffsetDateTime sessionStart = null;

        Optional<Session> activeSessionOpt = sessionRepository.findActiveSessionByComputerId(computer.getId());
        if (activeSessionOpt.isPresent()) {
            Session s = activeSessionOpt.get();
            userFullName = s.getUser().getFullName();
            userRole = s.getRole();
            sessionStart = s.getStartTime();
        }

        return ComputerDetailDto.builder()
            .id(computer.getId())
            .labId(computer.getLab().getId())
            .labCode(computer.getLab().getCode())
            .labName(computer.getLab().getName())
            .pcCode(computer.getPcCode())
            .hostname(computer.getHostname())
            .ipAddress(computer.getIpAddress())
            .status(computer.getStatus())
            .isOnline(computer.getIsOnline())
            .lastHeartbeat(computer.getLastHeartbeat())
            .clientVersion(computer.getClientVersion())
            .keyboardAssetId(kbAssetId)
            .keyboardStatus(kbStatus)
            .mouseAssetId(msAssetId)
            .mouseStatus(msStatus)
            .currentUserFullName(userFullName)
            .currentUserRole(userRole)
            .currentSessionStart(sessionStart)
            .build();
    }
}
